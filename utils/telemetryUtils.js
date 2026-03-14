// utils/telemetryUtils.js
// Utility functions for GPS telemetry enrichment

const https = require('https');
const Telemetry = require('../models/telemetry');

// ---------------------------------------------------------------------------
// 1. Haversine distance between two [lon, lat] coordinate pairs (in km)
// ---------------------------------------------------------------------------
function haversineDistance([lon1, lat1], [lon2, lat2]) {
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// 2. Get maximum speed (km/h) for the current session
// ---------------------------------------------------------------------------
async function getMaxSpeed(sessionId, currentSpeed) {
    try {
        const result = await Telemetry.findOne(
            { session_id: sessionId },
            { max_speed: 1 },
            { sort: { max_speed: -1 } }
        );
        const previousMax = result ? (result.max_speed || 0) : 0;
        return Math.max(previousMax, currentSpeed || 0);
    } catch (err) {
        console.error('[telemetryUtils] getMaxSpeed error:', err.message);
        return currentSpeed || 0;
    }
}

// ---------------------------------------------------------------------------
// 3. Get average speed (km/h) for the current session
// ---------------------------------------------------------------------------
async function getAvgSpeed(sessionId, currentSpeed) {
    try {
        const records = await Telemetry.find(
            { session_id: sessionId },
            { speed: 1 }
        ).lean();

        const allSpeeds = records.map((r) => r.speed || 0);
        allSpeeds.push(currentSpeed || 0);

        const total = allSpeeds.reduce((sum, s) => sum + s, 0);
        return parseFloat((total / allSpeeds.length).toFixed(2));
    } catch (err) {
        console.error('[telemetryUtils] getAvgSpeed error:', err.message);
        return currentSpeed || 0;
    }
}

// ---------------------------------------------------------------------------
// 4. Get total distance travelled (km) for the current session
// ---------------------------------------------------------------------------
async function getTotalDistance(sessionId, currentCoords) {
    try {
        const records = await Telemetry.find(
            { session_id: sessionId },
            { location: 1, timestamp: 1 }
        )
            .sort({ timestamp: 1 })
            .lean();

        if (!records.length) return 0;

        let totalKm = 0;

        for (let i = 1; i < records.length; i++) {
            const prev = records[i - 1].location.coordinates;
            const curr = records[i].location.coordinates;
            totalKm += haversineDistance(prev, curr);
        }

        const lastCoords = records[records.length - 1].location.coordinates;
        totalKm += haversineDistance(lastCoords, currentCoords);

        return parseFloat(totalKm.toFixed(3));
    } catch (err) {
        console.error('[telemetryUtils] getTotalDistance error:', err.message);
        return 0;
    }
}

// ---------------------------------------------------------------------------
// 5. Reverse-geocode coordinates using OpenStreetMap Nominatim
// ---------------------------------------------------------------------------
function getPositionName(lat, lon) {
    return new Promise((resolve) => {
        const url =
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
            `&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;

        const options = {
            headers: {
                'User-Agent': 'vlts-server/1.0 (telemetry-enrichment)',
                'Accept-Language': 'en'
            }
        };

        https
            .get(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const addr = json.address || {};
                        const parts = [
                            addr.road || addr.pedestrian || addr.footway,
                            addr.suburb || addr.neighbourhood || addr.village,
                            addr.city || addr.town || addr.county,
                            addr.state,
                            addr.country
                        ].filter(Boolean);

                        resolve(parts.length ? parts.join(', ') : (json.display_name || 'Unknown'));
                    } catch (parseErr) {
                        console.error('[telemetryUtils] getPositionName parse error:', parseErr.message);
                        resolve('Unknown');
                    }
                });
            })
            .on('error', (err) => {
                console.error('[telemetryUtils] getPositionName request error:', err.message);
                resolve('Unknown');
            });
    });
}

// ---------------------------------------------------------------------------
// 6. Get total number of overspeeding events for the current session
// ---------------------------------------------------------------------------
async function getOverspeedCount(sessionId, currentSpeed, overspeedLimit) {
    try {
        const result = await Telemetry.findOne(
            { session_id: sessionId },
            { overspeed_count: 1 },
            { sort: { timestamp: -1 } }
        );

        const previousCount = result ? (result.overspeed_count || 0) : 0;
        return currentSpeed > overspeedLimit ? previousCount + 1 : previousCount;
    } catch (err) {
        console.error('[telemetryUtils] getOverspeedCount error:', err.message);
        return 0;
    }
}

// ---------------------------------------------------------------------------
// 7. Get total number of geofence crossing events for the current session
// ---------------------------------------------------------------------------
async function getGeofenceCrossingCount(sessionId, currentStatus) {
    try {
        const result = await Telemetry.findOne(
            { session_id: sessionId },
            { geofence_status: 1, geofence_crossing_count: 1 },
            { sort: { timestamp: -1 } }
        );

        if (!result) return 0;

        const previousStatus = result.geofence_status;
        const previousCount = result.geofence_crossing_count || 0;

        const hasChanged =
            previousStatus !== currentStatus &&
            previousStatus !== 'UNKNOWN' &&
            currentStatus !== 'UNKNOWN';

        return hasChanged ? previousCount + 1 : previousCount;
    } catch (err) {
        console.error('[telemetryUtils] getGeofenceCrossingCount error:', err.message);
        return 0;
    }
}

// ---------------------------------------------------------------------------
// 8. Calculate run time and idle time (in minutes) since 12:00 AM today
//
//    Logic:
//    - Fetch all telemetry records for this session from midnight onwards,
//      sorted by timestamp ascending.
//    - Walk consecutive pairs of records. For each interval [t_prev → t_curr]:
//        • if the vehicle state at t_prev was MOVING  → add interval to run_time
//        • if the vehicle state at t_prev was PARKED  → add interval to idle_time
//    - Also account for the open interval from the last saved record up to
//      the current packet timestamp using the current state.
//
//    Example:
//      1:00 AM  MOVING  →  3:00 PM  (ran for 14 h = 840 min)  → covered 50 km
//      3:00 PM  PARKED  →  6:00 PM  (idle for 3 h = 180 min)   (current time)
//      Total since midnight:  run = 840 min, idle = 180 min
// ---------------------------------------------------------------------------
async function getRunIdleTime(sessionId, currentTimestamp, currentState) {
    try {
        // Midnight of the current day (local time anchored to UTC midnight)
        const midnight = new Date(currentTimestamp);
        midnight.setHours(0, 0, 0, 0);

        const records = await Telemetry.find(
            {
                session_id: sessionId,
                timestamp: { $gte: midnight }
            },
            { timestamp: 1, state: 1 }
        )
            .sort({ timestamp: 1 })
            .lean();

        let runMinutes = 0;
        let idleMinutes = 0;

        // Helper: accumulate an interval into the correct bucket
        const accumulate = (state, fromMs, toMs) => {
            const diffMin = (toMs - fromMs) / 60000;
            if (diffMin <= 0) return;
            if (state === 'MOVING') {
                runMinutes += diffMin;
            } else {
                // PARKED or any other state counts as idle
                idleMinutes += diffMin;
            }
        };

        if (records.length === 0) {
            // No prior records today — the entire interval from midnight to now
            // is assumed idle (vehicle hasn't been seen yet)
            accumulate(currentState, midnight.getTime(), currentTimestamp.getTime());
        } else {
            // Walk saved records
            for (let i = 1; i < records.length; i++) {
                const prev = records[i - 1];
                accumulate(prev.state, new Date(prev.timestamp).getTime(), new Date(records[i].timestamp).getTime());
            }

            // Open interval: last saved record → current packet
            const last = records[records.length - 1];
            accumulate(last.state, new Date(last.timestamp).getTime(), currentTimestamp.getTime());
        }

        return {
            run_time_minutes: parseFloat(runMinutes.toFixed(2)),
            idle_time_minutes: parseFloat(idleMinutes.toFixed(2))
        };
    } catch (err) {
        console.error('[telemetryUtils] getRunIdleTime error:', err.message);
        return { run_time_minutes: 0, idle_time_minutes: 0 };
    }
}

module.exports = {
    haversineDistance,
    getMaxSpeed,
    getAvgSpeed,
    getTotalDistance,
    getPositionName,
    getOverspeedCount,
    getGeofenceCrossingCount,
    getRunIdleTime
};