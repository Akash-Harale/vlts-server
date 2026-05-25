const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    gps_id: { type: mongoose.Schema.Types.ObjectId, ref: "GPSDevice" },
    alert_type: {
        type: String,
        enum: ["manual", "auto"]
    },
    status: {
        type: Boolean,
        default: true
    },
    day: {
        type: String,
        enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    },
    start_time: { type: Date },   // stored as UTC, display in IST via util
    end_time: { type: Date },     // stored as UTC, display in IST via util
    location: [{
        longitude: Number,
        latitude: Number,
    }],
    radius: Number,
    // 4 Types of alerts
    tamper_alert: { type: Boolean, default: true },
    fuel_alert: { type: Boolean, default: true },
    movement_alert: { type: Boolean, default: true },
    ignition_alert: { type: Boolean, default: true },
}, { timestamps: true });

const Alert = mongoose.model("Alert", alertSchema);

module.exports = Alert;
