// Date: 7th March 2026 
// used for POC by direct call from server.js

// workers/enrichmentWorker.js
const GPSRawData = require('../models/gpsRawData');
const GPSDevice = require('../models/gpsDevice');
const Vehicle = require('../models/vehicle');
const VehicleDeviceMap = require('../models/vehicleDeviceMap');
const DriverVehicleAssignment = require('../models/driverVehicleAssignment');
const Trip = require('../models/trip');
const Telemetry = require('../models/telemetry');
const GpsAlert = require('../models/gpsAlert');
const { v4: uuidv4 } = require('uuid');
const { broadcastTelemetry } = require('../services/wsServer');
const turf = require('@turf/turf');
const telemetryUtils = require('../utils/telemetryUtils');

const activeSessions = new Map();
const OVERSPEED_LIMIT = process.env.OVERSPEED_LIMIT || 80;
const POLL_INTERVAL_MS = process.env.POLL_INTERVAL_MS || 2000;

// -------------------- Helpers --------------------

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
    //}).lean();
  }).populate('vehicle_id', 'registration_number make model').lean();
  if (!mapping) {
    await GPSRawData.updateOne({ _id: rawDoc._id }, { error: 'No active vehicle mapping' });
    return null;
  }

  //console.log("Vehicle mapping result:", mapping);
  //console.log("Populated vehicle:", mapping?.vehicle_id);

  return mapping.vehicle_id; // plain object
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
    driverId: assignment ? assignment.driver_id : null,
    routeId: null,
    tripId: null
  };
}

function getOrCreateSession(vehicleId) {
  const vidStr = vehicleId.toString();
  let sessionId = activeSessions.get(vidStr);
  if (!sessionId) {
    sessionId = uuidv4();
    activeSessions.set(vidStr, sessionId);
    console.log(`[enrichmentWorker] New session started for vehicle ${vidStr}: ${sessionId}`);
  }
  return sessionId;
}

function checkGeofence(vehicle, locationPoint) {
  if (!vehicle.geofencePolygon || !vehicle.geofencePolygon.coordinates) return "UNKNOWN";
  try {
    const polygon = turf.polygon(vehicle.geofencePolygon.coordinates);
    const point = turf.point(locationPoint.coordinates);
    return turf.booleanPointInPolygon(point, polygon) ? "WITHIN" : "OUTSIDE";
  } catch (err) {
    console.error("[enrichmentWorker] Geofence check error:", err.message);
    return "ERROR";
  }
}

function buildTelemetry(rawDoc, gpsDevice, vehicle, driverId, routeId, tripId, sessionId) {
  // Return a promise to handle async utility functions
  return (async () => {
    const locationPoint = {
      type: 'Point',
      coordinates: [rawDoc.raw_payload.lon, rawDoc.raw_payload.lat]
    };

    const geofenceStatus = checkGeofence(vehicle, locationPoint);

    // Calculate derived metrics
    const maxSpeed = await telemetryUtils.getMaxSpeed(sessionId, rawDoc.raw_payload.speed);
    const avgSpeed = await telemetryUtils.getAvgSpeed(sessionId, rawDoc.raw_payload.speed);
    const totalDistance = await telemetryUtils.getTotalDistance(sessionId, locationPoint.coordinates);
    const positionName = await telemetryUtils.getPositionName(rawDoc.raw_payload.lat, rawDoc.raw_payload.lon);

    return new Telemetry({
      session_id: sessionId,
      timestamp: new Date(),
      imei: rawDoc.imei,
      gps_device_id: gpsDevice._id,
      vehicle_id: vehicle._id,
      driver_id: driverId,
      route_id: routeId,
      trip_id: tripId,
      location: locationPoint,
      speed: rawDoc.raw_payload.speed,
      direction: rawDoc.raw_payload.direction,
      state: rawDoc.raw_payload.speed > 5 ? 'MOVING' : 'PARKED',
      geofence_status: geofenceStatus,
      max_speed: maxSpeed,
      avg_speed: avgSpeed,
      total_distance: totalDistance,
      position_name: positionName,
      raw_payload: rawDoc.raw_payload
    });
  })();
}

// -------------------- Alert Logic --------------------
async function triggerAlerts(telemetry) {
  const alerts = [];

  if (telemetry.speed > OVERSPEED_LIMIT) {
    alerts.push({
      type: "OVERSPEED",
      message: `Vehicle ${telemetry.vehicle_id} overspeeding at ${telemetry.speed} km/h`,
      vehicle_id: telemetry.vehicle_id,
      telemetry_id: telemetry._id,
      timestamp: telemetry.timestamp,
      severity: "CRITICAL"
    });
  }

  if (telemetry.geofence_status === "OUTSIDE") {
    alerts.push({
      type: "GEOFENCE",
      message: `Vehicle ${telemetry.vehicle_id} exited geofence`,
      vehicle_id: telemetry.vehicle_id,
      telemetry_id: telemetry._id,
      timestamp: telemetry.timestamp,
      severity: "WARNING"
    });
  }

  if (alerts.length > 0) {
    await GpsAlert.insertMany(alerts);
    alerts.forEach(alert => console.log("[enrichmentWorker] GpsAlert triggered:", alert.message));
  }
}

// -------------------- Main Processor --------------------
async function processRawPackets(wss) {
  const rawDocs = await GPSRawData.find({ processed: false }).limit(10).lean();
 console.log("rawDocs", rawDocs)
  //console.log('processRawPackets called....: ');

  for (const rawDoc of rawDocs) {
    try {
      const gpsDevice = await resolveDevice(rawDoc);
      if (!gpsDevice) continue;

      //console.log('gpsDevice Line# 166: rawDoc: ', rawDoc, ' : gpsDevice: ', gpsDevice);

      const vehicle = await resolveVehicle(gpsDevice, rawDoc);
      //console.log('Vehicle Line# 169: ', vehicle);

      if (!vehicle) continue;

      const { driverId, routeId, tripId } = await resolveTripAndDriver(vehicle);
      const sessionId = getOrCreateSession(vehicle._id);

      //console.log(' Line# 176: ', vehicle);

      const telemetry = await buildTelemetry(rawDoc, gpsDevice, vehicle, driverId, routeId, tripId, sessionId);


      if (telemetry) { // Process only if telemetry daata found
        await telemetry.save();
        await GPSRawData.updateOne({ _id: rawDoc._id }, { processed: true });

        broadcastTelemetry(wss, telemetry);

        await triggerAlerts(telemetry);
        console.log("[enrichmentWorker] Telemetry saved, broadcasted and alert triggered:", telemetry.id);
      } else {
        console.log('processRawPackets: No telemetry data found, Nothing to broadcast');
      }
    } catch (err) {
      console.error("[enrichmentWorker] Error enriching packet:", err.message);
    }
  }
}

// -------------------- Continuous Loop --------------------
function startEnrichmentLoop(wss) {
  console.log('startEnrichmentLoop called....');
  async function loop() {
    await processRawPackets(wss);
    setTimeout(loop, POLL_INTERVAL_MS);
  }
  loop();
}

module.exports = { startEnrichmentLoop };
//module.exports = { processRawPackets };
