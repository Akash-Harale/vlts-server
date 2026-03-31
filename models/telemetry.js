// models/telemetry.js
const mongoose = require("mongoose");

const telemetrySchema = new mongoose.Schema({
    session_id: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    imei: { type: String, required: true },
    gps_device_id: { type: mongoose.Schema.Types.ObjectId, ref: "GPSDevice" },
    vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    driver_id: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
    route_id: { type: mongoose.Schema.Types.ObjectId, ref: "Route" },
    trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    location: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], required: true }
    },
    speed: Number,
    direction: Number,
    state: { type: String, enum: ["MOVING", "PARKED"] },
    geofence_status: { type: String, enum: ["WITHIN", "OUTSIDE", "UNKNOWN", "ERROR"] },
    max_speed: { type: Number, default: 0 },
    avg_speed: { type: Number, default: 0 },
    total_distance: { type: Number, default: 0 },  // in km
    position_name: { type: String, default: 'Unknown' },
    overspeed_count: { type: Number, default: 0 },
    geofence_crossing_count: { type: Number, default: 0 },
    raw_payload: Object,
    created_at: { type: Date, default: Date.now },
});

telemetrySchema.index({ location: "2dsphere" }); // for geospatial queries

module.exports = mongoose.model("Telemetry", telemetrySchema);
/*
Sample data:

{
  "session_id": "c1a2b3c4-d5e6-7890",
  "timestamp": "2026-02-28T00:45:00Z",
  "imei": "356938035643809",
  "vehicle_id": "V001",
  "driver_id": "D001",
  "trip_id": "T001",
  "route_id": "R001",
  "location": { "type": "Point", "coordinates": [77.2090, 28.6139] },
  "speed": 65,
  "direction": 142,
  "state": "MOVING"
}

*/