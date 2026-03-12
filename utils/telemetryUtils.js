// utils/telemetryUtils.js
// Utility functions for GPS telemetry enrichment

const https = require('https');
const Telemetry = require('../models/telemetry');

// ---------------------------------------------------------------------------
// 1. Haversine distance between two [lon, lat] coordinate pairs (in km)
// ---------------------------------------------------------------------------
function haversineDistance([lon1, lat1], [lon2, lat2]) {
    const R = 6371; // Earth radius in km
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// 2. Get maximum speed (km/h) for the current session from saved telemetry
//    plus the new (unsaved) speed reading
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
//    We recalculate as running average across all saved records + current
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
//    Sums Haversine distances between consecutive coordinate points,
//    then adds the leg from the last saved point to the current one
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

        // Sum distance across saved points
        for (let i = 1; i < records.length; i++) {
            const prev = records[i - 1].location.coordinates;
            const curr = records[i].location.coordinates;
            totalKm += haversineDistance(prev, curr);
        }

        // Add leg from last saved point to current position
        const lastCoords = records[records.length - 1].location.coordinates;
        totalKm += haversineDistance(lastCoords, currentCoords);

        console.log(`[telemetryUtils] getTotalDistance -> session: ${sessionId}, records: ${records.length}, totalKm computed so far: ${totalKm}`);

        return parseFloat(totalKm.toFixed(3));
    } catch (err) {
        console.error('[telemetryUtils] getTotalDistance error:', err.message);
        return 0;
    }
}

// ---------------------------------------------------------------------------
// 5. Reverse-geocode coordinates using OpenStreetMap Nominatim
//    Returns a human-readable place name string
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
                        // Build a concise place name from address parts
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

module.exports = {
    haversineDistance,
    getMaxSpeed,
    getAvgSpeed,
    getTotalDistance,
    getPositionName
};