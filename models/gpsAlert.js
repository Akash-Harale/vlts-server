// models/gpsAlert.js
const mongoose = require("mongoose");

const gpsAlertSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["OVERSPEED", "GEOFENCE", "DEVICE_ERROR", "OTHER"],
        required: true,
    },
    message: { type: String, required: true },
    vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    telemetry_id: { type: mongoose.Schema.Types.ObjectId, ref: "Telemetry" },
    timestamp: { type: Date, default: Date.now },
    severity: {
        type: String,
        enum: ["INFO", "WARNING", "CRITICAL"],
        default: "WARNING",
    },
    acknowledged: { type: Boolean, default: false },
});

module.exports = mongoose.model("GpsAlert", gpsAlertSchema);
