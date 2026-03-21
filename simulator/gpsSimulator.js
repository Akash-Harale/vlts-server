// simulator/gpsSimulator.js
// Route-aware Multi GPS Device Simulator
// Fetches active trips from MongoDB and walks each device along the actual route.

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const net = require('net');
const mongoose = require('mongoose');

// ── Models ────────────────────────────────────────────────────────────────────
const Trip = require('../models/trip');
const Route = require('../models/route');

// ── Config ────────────────────────────────────────────────────────────────────
const HOST = 'localhost';
const PORT = 3007;
const SEND_INTERVAL_MS = 3000;   // emit a point every 3 s
const JITTER_DEG       = 0.0002; // ±~20 m GPS noise
const RETRY_DELAY_MS   = 5000;   // reconnect delay on socket close

// ──────────────────────────────────────────────────────────────────────────────
// Small helper: add Gaussian-ish jitter to a coordinate
// ──────────────────────────────────────────────────────────────────────────────
function jitter(val) {
    return val + (Math.random() - 0.5) * JITTER_DEG;
}

// ──────────────────────────────────────────────────────────────────────────────
// Simulate one device along the given route waypoints [[lng, lat], ...]
// ──────────────────────────────────────────────────────────────────────────────
function simulateDevice({ imei, waypoints }) {
    let waypointIndex = 0;
    let client;
    let interval;

    const connect = () => {
        client = new net.Socket();

        client.connect(PORT, HOST, () => {
            console.log(`[Sim] Device ${imei} connected → walking ${waypoints.length} waypoints`);

            interval = setInterval(() => {
                // Wrap around when we reach the end of the route
                if (waypointIndex >= waypoints.length) {
                    waypointIndex = 0;
                    console.log(`[Sim] Device ${imei} looped back to route start`);
                }

                const [lng, lat] = waypoints[waypointIndex++];

                const telemetry = {
                    imei,
                    lat: jitter(lat),
                    lon: jitter(lng),
                    speed: Math.floor(Math.random() * 60) + 10,   // 10–70 km/h
                    direction: Math.floor(Math.random() * 360)
                };

                client.write(JSON.stringify(telemetry));
                console.log(`[Sim] ${imei} → waypoint ${waypointIndex}/${waypoints.length}`, telemetry);
            }, SEND_INTERVAL_MS);
        });

        client.on('error', (err) => {
            console.error(`[Sim] Device ${imei} socket error: ${err.message}`);
        });

        client.on('close', () => {
            console.log(`[Sim] Device ${imei} disconnected. Retrying in ${RETRY_DELAY_MS / 1000}s…`);
            if (interval) clearInterval(interval);
            setTimeout(connect, RETRY_DELAY_MS);
        });
    };

    connect();
}

// ──────────────────────────────────────────────────────────────────────────────
// Main: connect to Mongo, load active trips + routes, start simulators
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
    console.log('[Sim] Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Sim] MongoDB connected');

    // Fetch ACTIVE trips and populate both their GPS device IMEI and route geometry
    const trips = await Trip.find({ status: 'ACTIVE' })
        .populate('route_id')
        .lean();

    if (trips.length === 0) {
        console.warn('[Sim] No ACTIVE trips found in the database. Exiting.');
        process.exit(0);
    }

    // Also need the IMEI for each vehicle  ─ pull from vehicleDeviceMap
    const VehicleDeviceMap = require('../models/vehicleDeviceMap');
    const GpsDevice = require('../models/gpsDevice');

    const devices = [];

    for (const trip of trips) {
        const route = trip.route_id;

        if (!route || !route.geometry || !route.geometry.coordinates || route.geometry.coordinates.length < 2) {
            console.warn(`[Sim] Trip ${trip._id} has no usable route geometry – skipping`);
            continue;
        }

        // Find the active device mapped to this vehicle
        const mapping = await VehicleDeviceMap.findOne({
            vehicle_id: trip.vehicle_id,
            status: 'MAPPED'
        }).lean();

        if (!mapping) {
            console.warn(`[Sim] No active device mapping for vehicle ${trip.vehicle_id} – skipping`);
            continue;
        }

        const gpsDevice = await GpsDevice.findById(mapping.gps_device_id).lean();
        if (!gpsDevice || !gpsDevice.imei) {
            console.warn(`[Sim] No GPS device found for mapping ${mapping._id} – skipping`);
            continue;
        }

        console.log(`[Sim] Trip ${trip._id} → vehicle ${trip.vehicle_id} → IMEI ${gpsDevice.imei} → route "${route.name}" (${route.geometry.coordinates.length} pts)`);

        devices.push({
            imei: gpsDevice.imei,
            waypoints: route.geometry.coordinates  // [[lng, lat], ...]
        });
    }

    if (devices.length === 0) {
        console.warn('[Sim] No simulatable devices found. Check trips, vehicle-device mappings, and GPS devices.');
        process.exit(0);
    }

    console.log(`[Sim] Starting simulation for ${devices.length} device(s)…`);
    devices.forEach(simulateDevice);
}

main().catch(err => {
    console.error('[Sim] Fatal error:', err);
    process.exit(1);
});