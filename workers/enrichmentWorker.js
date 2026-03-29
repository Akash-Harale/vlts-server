/* Commented on 29th March 2026 to use Navitech Device data

// workers/enrichmentWorker.js
// Date: March 2026 - POC version with geofence fix

const GPSRawData = require('../models/gpsData');
const GPSDevice = require('../models/gpsDevice');
const Vehicle = require('../models/vehicle');
const VehicleDeviceMap = require('../models/vehicleDeviceMap');
const DriverVehicleAssignment = require('../models/driverVehicleAssignment');
const Trip = require('../models/trip');
const Telemetry = require('../models/telemetry');
const GpsAlert = require('../models/gpsAlert');
const Geofence = require('../models/geofence');
const { v4: uuidv4 } = require('uuid');
const { broadcastTelemetry } = require('../services/wsServer');
const turf = require('@turf/turf');
const telemetryUtils = require('../utils/telemetryUtils');

const activeSessions = new Map();
const OVERSPEED_LIMIT = Number(process.env.OVERSPEED_LIMIT) || 1;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 2000;

// ── Helpers ────────────────────────────────────────────────

async function resolveDevice(rawDoc) {
  const gpsDevice = await GPSDevice.findOne({ imei: rawDoc.imei }).lean();
  if (!gpsDevice || gpsDevice.status !== 'ACTIVE') {
    await GPSRawData.updateOne({ _id: rawDoc._id }, { error: 'Device not active or faulty' });
    return null;
  }
  return gpsDevice;
}

async function resolveVehicle(gpsDevice, rawDoc) {
  const mapping = await VehicleDeviceMap.findOne({
    gps_device_id: gpsDevice._id,
    status: 'MAPPED'
  })
    .populate('vehicle_id', 'registration_number make model')
    .lean();

  if (!mapping) {
    await GPSRawData.updateOne({ _id: rawDoc._id }, { error: 'No active vehicle mapping' });
    return null;
  }

  return mapping.vehicle_id;
}

async function resolveTripAndDriver(vehicle) {
  const now = new Date();

  const activeTrip = await Trip.findOne({
    vehicle_id: vehicle._id,
    status: 'ACTIVE',
    departure_time: { $lte: now },
    arrival_time: { $gte: now }
  }).lean();

  if (activeTrip) {
    return {
      driverId: activeTrip.driver_id,
      routeId: activeTrip.route_id,
      tripId: activeTrip._id
    };
  }

  const assignment = await DriverVehicleAssignment.findOne({
    vehicle_id: vehicle._id,
    status: 'ACTIVE',
    from_datetime: { $lte: now },
    to_datetime: { $gte: now }
  }).lean();

  return {
    driverId: assignment?.driver_id || null,
    routeId: null,
    tripId: null
  };
}

function getOrCreateSession(vehicleId) {
  const vidStr = vehicleId.toString();
  if (!activeSessions.has(vidStr)) {
    const sessionId = uuidv4();
    activeSessions.set(vidStr, sessionId);
    console.log(`[enrichment] New session for vehicle ${vidStr}: ${sessionId}`);
  }
  return activeSessions.get(vidStr);
}

// ── Geofence check ─────────────────────────────────────────

async function checkGeofence(routeId, locationPoint) {
  if (!routeId) return 'UNKNOWN';

  try {
    const geofence = await Geofence.findOne({ route_id: routeId }).lean();
    if (!geofence?.geometry?.coordinates) return 'UNKNOWN';

    const polygon = turf.polygon(geofence.geometry.coordinates);
    const point = turf.point(locationPoint.coordinates);

    return turf.booleanPointInPolygon(point, polygon) ? 'WITHIN' : 'OUTSIDE';
  } catch (err) {
    console.error('[enrichment] Geofence check failed:', err.message);
    return 'ERROR';
  }
}

// ── Build enriched telemetry document ──────────────────────

async function buildTelemetry(rawDoc, gpsDevice, vehicle, driverId, routeId, tripId, sessionId) {
  const locationPoint = {
    type: 'Point',
    coordinates: [rawDoc.raw_payload.lon, rawDoc.raw_payload.lat]
  };

  // last_updated is the timestamp from the device payload itself (sending time)
  const lastUpdated = rawDoc.raw_payload.timestamp
    ? new Date(rawDoc.raw_payload.timestamp)
    : new Date();

  const vehicleState = rawDoc.raw_payload.speed > 5 ? 'MOVING' : 'PARKED';

  const geofenceStatus = await checkGeofence(routeId, locationPoint);
  const finalGeofenceStatus = geofenceStatus ?? 'UNKNOWN';

  const [
    maxSpeed,
    avgSpeed,
    totalDistance,
    positionName,
    overspeedCount,
    geofenceCrossingCount,
    { run_time_minutes, idle_time_minutes }
  ] = await Promise.all([
    telemetryUtils.getMaxSpeed(sessionId, rawDoc.raw_payload.speed),
    telemetryUtils.getAvgSpeed(sessionId, rawDoc.raw_payload.speed),
    telemetryUtils.getTotalDistance(sessionId, locationPoint.coordinates),
    telemetryUtils.getPositionName(rawDoc.raw_payload.lat, rawDoc.raw_payload.lon),
    telemetryUtils.getOverspeedCount(sessionId, rawDoc.raw_payload.speed, OVERSPEED_LIMIT),
    telemetryUtils.getGeofenceCrossingCount(sessionId, finalGeofenceStatus),
    // Pass the packet's own timestamp so run/idle are calculated against the
    // correct "now", not the server wall-clock time.
    telemetryUtils.getRunIdleTime(sessionId, lastUpdated, vehicleState)
  ]);

  return new Telemetry({
    session_id: sessionId,

    // ── Time fields ───────────────────────────────────────
    timestamp: new Date(),          // server ingestion time
    last_updated: lastUpdated,      // device sending time (from raw payload)

    // ── Identity ──────────────────────────────────────────
    imei: rawDoc.imei,
    gps_device_id: gpsDevice._id,
    vehicle_id: vehicle._id,
    driver_id: driverId,
    route_id: routeId,
    trip_id: tripId,

    // ── Position & motion ─────────────────────────────────
    location: locationPoint,
    speed: rawDoc.raw_payload.speed,
    direction: rawDoc.raw_payload.direction,
    state: vehicleState,
    position_name: positionName,

    // ── Session-level aggregates ──────────────────────────
    max_speed: maxSpeed,
    avg_speed: avgSpeed,
    total_distance: totalDistance,
    overspeed_count: overspeedCount,

    // ── Daily run / idle times (since 12:00 AM) ───────────
    run_time_minutes,   // minutes vehicle was MOVING since midnight
    idle_time_minutes,  // minutes vehicle was PARKED/idle since midnight

    // ── Geofence ──────────────────────────────────────────
    geofence_status: finalGeofenceStatus,
    geofence_crossing_count: geofenceCrossingCount,

    // ── Raw data ──────────────────────────────────────────
    raw_payload: rawDoc.raw_payload
  });
}

// ── Alerting logic ──────────────────────────────────────────

async function triggerAlerts(telemetry) {
  const alerts = [];

  if (telemetry.speed > OVERSPEED_LIMIT) {
    alerts.push({
      type: 'OVERSPEED',
      message: `Vehicle ${telemetry.vehicle_id} overspeeding at ${telemetry.speed} km/h`,
      vehicle_id: telemetry.vehicle_id,
      telemetry_id: telemetry._id,
      timestamp: telemetry.timestamp,
      severity: 'CRITICAL'
    });
  }

  if (telemetry.geofence_status === 'OUTSIDE') {
    alerts.push({
      type: 'GEOFENCE',
      message: `Vehicle ${telemetry.vehicle_id} exited geofence`,
      vehicle_id: telemetry.vehicle_id,
      telemetry_id: telemetry._id,
      timestamp: telemetry.timestamp,
      severity: 'WARNING'
    });
  }

  if (alerts.length > 0) {
    await GpsAlert.insertMany(alerts);
    alerts.forEach(a => console.log('[enrichment] Alert:', a.message));
  }
}

// ── Main processing loop ───────────────────────────────────

async function processRawPackets(wss) {
  const rawDocs = await GPSRawData.find({ processed: false })
    .limit(10)
    .lean()
    .sort({ timestamp: 1 });

  if (!rawDocs.length) return;

  console.log(`[enrichment] Processing ${rawDocs.length} raw packets`);

  for (const rawDoc of rawDocs) {
    try {
      const gpsDevice = await resolveDevice(rawDoc);
      if (!gpsDevice) continue;

      const vehicle = await resolveVehicle(gpsDevice, rawDoc);
      if (!vehicle) continue;

      const { driverId, routeId, tripId } = await resolveTripAndDriver(vehicle);
      const sessionId = getOrCreateSession(vehicle._id);

      const telemetryDoc = await buildTelemetry(
        rawDoc,
        gpsDevice,
        vehicle,
        driverId,
        routeId,
        tripId,
        sessionId
      );

      // Debug log
      console.log(
        `[DEBUG] vehicle ${vehicle._id} → geofence_status=${telemetryDoc.geofence_status}` +
        ` | state=${telemetryDoc.state}` +
        ` | run=${telemetryDoc.run_time_minutes}min | idle=${telemetryDoc.idle_time_minutes}min` +
        ` | last_updated=${telemetryDoc.last_updated}`
      );

      await telemetryDoc.save();
      await GPSRawData.updateOne({ _id: rawDoc._id }, { processed: true });

      // Update trip stats if applicable
      if (tripId) {
        await Trip.updateOne(
          { _id: tripId },
          {
            $set: {
              max_speed: telemetryDoc.max_speed,
              avg_speed: telemetryDoc.avg_speed,
              total_distance: telemetryDoc.total_distance,
              position_name: telemetryDoc.position_name,
              overspeed_count: telemetryDoc.overspeed_count,
              geofence_crossing_count: telemetryDoc.geofence_crossing_count,
              run_time_minutes: telemetryDoc.run_time_minutes,
              idle_time_minutes: telemetryDoc.idle_time_minutes
            }
          }
        );
      }

      broadcastTelemetry(wss, telemetryDoc);
      await triggerAlerts(telemetryDoc);

      console.log(`[enrichment] Saved & broadcasted: ${telemetryDoc._id}`);
    } catch (err) {
      console.error('[enrichment] Error processing packet:', err.message, err.stack);
    }
  }
}

// ── Continuous polling ─────────────────────────────────────

function startEnrichmentLoop(wss) {
  console.log('[enrichment] Starting processing loop...');

  async function loop() {
    try {
      await processRawPackets(wss);
    } catch (err) {
      console.error('[enrichment] Loop crash:', err);
    }
    setTimeout(loop, POLL_INTERVAL_MS);
  }

  loop();
}

module.exports = { startEnrichmentLoop };

*/

// workers/enrichmentWorker.js
// Date: March 2026 - Refactored for unified gpsData store

const GPSData = require('../models/gpsData');          // unified raw+parsed schema
const GPSDevice = require('../models/gpsDevice');
const Vehicle = require('../models/vehicle');
const VehicleDeviceMap = require('../models/vehicleDeviceMap');
const DriverVehicleAssignment = require('../models/driverVehicleAssignment');
const Trip = require('../models/trip');
const Telemetry = require('../models/telemetry');
const GpsAlert = require('../models/gpsAlert');
const Geofence = require('../models/geofence');
const { v4: uuidv4 } = require('uuid');
const { broadcastTelemetry } = require('../services/wsServer');
const turf = require('@turf/turf');
const telemetryUtils = require('../utils/telemetryUtils');

const activeSessions = new Map();
const OVERSPEED_LIMIT = Number(process.env.OVERSPEED_LIMIT) || 1;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 2000;

// ── Helpers ────────────────────────────────────────────────

async function resolveDevice(rawDoc) {
  const gpsDevice = await GPSDevice.findOne({ imei: rawDoc.imei }).lean();
  if (!gpsDevice || gpsDevice.status !== 'ACTIVE') {
    await GPSData.updateOne({ _id: rawDoc._id }, { error: 'Device not active or faulty' });
    return null;
  }
  return gpsDevice;
}

async function resolveVehicle(gpsDevice, rawDoc) {
  const mapping = await VehicleDeviceMap.findOne({
    gps_device_id: gpsDevice._id,
    status: 'MAPPED'
  })
    .populate('vehicle_id', 'registration_number make model')
    .lean();

  if (!mapping) {
    await GPSData.updateOne({ _id: rawDoc._id }, { error: 'No active vehicle mapping' });
    return null;
  }

  return mapping.vehicle_id;
}

async function resolveTripAndDriver(vehicle) {
  const now = new Date();

  const activeTrip = await Trip.findOne({
    vehicle_id: vehicle._id,
    status: 'ACTIVE',
    departure_time: { $lte: now },
    arrival_time: { $gte: now }
  }).lean();

  if (activeTrip) {
    return {
      driverId: activeTrip.driver_id,
      routeId: activeTrip.route_id,
      tripId: activeTrip._id
    };
  }

  const assignment = await DriverVehicleAssignment.findOne({
    vehicle_id: vehicle._id,
    status: 'ACTIVE',
    from_datetime: { $lte: now },
    to_datetime: { $gte: now }
  }).lean();

  return {
    driverId: assignment?.driver_id || null,
    routeId: null,
    tripId: null
  };
}

function getOrCreateSession(vehicleId) {
  const vidStr = vehicleId.toString();
  if (!activeSessions.has(vidStr)) {
    const sessionId = uuidv4();
    activeSessions.set(vidStr, sessionId);
    console.log(`[enrichment] New session for vehicle ${vidStr}: ${sessionId}`);
  }
  return activeSessions.get(vidStr);
}

// ── Geofence check ─────────────────────────────────────────

async function checkGeofence(routeId, locationPoint) {
  if (!routeId) return 'UNKNOWN';

  try {
    const geofence = await Geofence.findOne({ route_id: routeId }).lean();
    if (!geofence?.geometry?.coordinates) return 'UNKNOWN';

    const polygon = turf.polygon(geofence.geometry.coordinates);
    const point = turf.point(locationPoint.coordinates);

    return turf.booleanPointInPolygon(point, polygon) ? 'WITHIN' : 'OUTSIDE';
  } catch (err) {
    console.error('[enrichment] Geofence check failed:', err.message);
    return 'ERROR';
  }
}

// ── Build enriched telemetry document ──────────────────────

async function buildTelemetry(rawDoc, gpsDevice, vehicle, driverId, routeId, tripId, sessionId) {
  // Extract lat/lon/speed/direction from parsed_fields
  const lat = Number(rawDoc.parsed_fields.find(f => f.field === 'latitude')?.value || 0);
  const lon = Number(rawDoc.parsed_fields.find(f => f.field === 'longitude')?.value || 0);
  const speed = Number(rawDoc.parsed_fields.find(f => f.field === 'speed')?.value || 0);
  const direction = rawDoc.parsed_fields.find(f => f.field === 'heading')?.value || null;

  const locationPoint = { type: 'Point', coordinates: [lon, lat] };
  const lastUpdated = rawDoc.received_at || new Date();
  const vehicleState = speed > 5 ? 'MOVING' : 'PARKED';

  const geofenceStatus = await checkGeofence(routeId, locationPoint);

  const [
    maxSpeed,
    avgSpeed,
    totalDistance,
    positionName,
    overspeedCount,
    geofenceCrossingCount,
    { run_time_minutes, idle_time_minutes }
  ] = await Promise.all([
    telemetryUtils.getMaxSpeed(sessionId, speed),
    telemetryUtils.getAvgSpeed(sessionId, speed),
    telemetryUtils.getTotalDistance(sessionId, locationPoint.coordinates),
    telemetryUtils.getPositionName(lat, lon),
    telemetryUtils.getOverspeedCount(sessionId, speed, OVERSPEED_LIMIT),
    telemetryUtils.getGeofenceCrossingCount(sessionId, geofenceStatus),
    telemetryUtils.getRunIdleTime(sessionId, lastUpdated, vehicleState)
  ]);

  return new Telemetry({
    session_id: sessionId,
    timestamp: new Date(),          // server ingestion time
    last_updated: lastUpdated,      // device sending time
    imei: rawDoc.imei,
    gps_device_id: gpsDevice._id,
    vehicle_id: vehicle._id,
    driver_id: driverId,
    route_id: routeId,
    trip_id: tripId,
    location: locationPoint,
    speed,
    direction,
    state: vehicleState,
    position_name: positionName,
    max_speed: maxSpeed,
    avg_speed: avgSpeed,
    total_distance: totalDistance,
    overspeed_count: overspeedCount,
    run_time_minutes,
    idle_time_minutes,
    geofence_status: geofenceStatus,
    geofence_crossing_count: geofenceCrossingCount,
    raw_payload: rawDoc // keep full raw doc for audit
  });
}

// ── Alerting logic ──────────────────────────────────────────

async function triggerAlerts(telemetry) {
  const alerts = [];

  if (telemetry.speed > OVERSPEED_LIMIT) {
    alerts.push({
      type: 'OVERSPEED',
      message: `Vehicle ${telemetry.vehicle_id} overspeeding at ${telemetry.speed} km/h`,
      vehicle_id: telemetry.vehicle_id,
      telemetry_id: telemetry._id,
      timestamp: telemetry.timestamp,
      severity: 'CRITICAL'
    });
  }

  if (telemetry.geofence_status === 'OUTSIDE') {
    alerts.push({
      type: 'GEOFENCE',
      message: `Vehicle ${telemetry.vehicle_id} exited geofence`,
      vehicle_id: telemetry.vehicle_id,
      telemetry_id: telemetry._id,
      timestamp: telemetry.timestamp,
      severity: 'WARNING'
    });
  }

  if (alerts.length > 0) {
    await GpsAlert.insertMany(alerts);
    alerts.forEach(a => console.log('[enrichment] Alert:', a.message));
  }
}

// ── Main processing loop ───────────────────────────────────

async function processRawPackets(wss) {
  const rawDocs = await GPSData.find({ processed: false, data_type: 'Tracking' })
    .limit(10)
    .lean()
    .sort({ received_at: 1 });

  if (!rawDocs.length) return;

  console.log(`[enrichment] Processing ${rawDocs.length} tracking packets`);

  for (const rawDoc of rawDocs) {
    try {
      const gpsDevice = await resolveDevice(rawDoc);
      if (!gpsDevice) continue;

      const vehicle = await resolveVehicle(gpsDevice, rawDoc);
      if (!vehicle) continue;

      const { driverId, routeId, tripId } = await resolveTripAndDriver(vehicle);
      const sessionId = getOrCreateSession(vehicle._id);

      const telemetryDoc = await buildTelemetry(rawDoc, gpsDevice, vehicle, driverId, routeId, tripId, sessionId);

      await telemetryDoc.save();
      await GPSData.updateOne({ _id: rawDoc._id }, { processed: true });

      broadcastTelemetry(wss, telemetryDoc);
      await triggerAlerts(telemetryDoc);

      console.log(`[enrichment] Saved & broadcasted telemetry: ${telemetryDoc._id}`);
    } catch (err) {
      console.error('[enrichment] Error processing packet:', err.message, err.stack);
    }
  }
}

// ── Continuous polling ─────────────────────────────────────

function startEnrichmentLoop(wss) {
  console.log('[enrichment] Starting processing loop...');

  async function loop() {
    try {
      await processRawPackets(wss);
    } catch (err) {
      console.error('[enrichment] Loop crash:', err);
    }
    setTimeout(loop, POLL_INTERVAL_MS);
  }

  loop();
}

module.exports = { startEnrichmentLoop };
