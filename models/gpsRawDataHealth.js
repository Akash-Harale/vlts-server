//  /modes/gpsRawDataHealth.js
// 26/03/2026

const mongoose = require("mongoose");

const gpsRawDataHealthSchema = new mongoose.Schema({
  raw_packet: { type: String, required: true },
  processed: { type: Boolean, default: false },
  imei: { type: String, index: true },
  header: String,
  vendor_id: String,
  firmware_version: String,
  battery_percentage: Number,
  low_battery_threshold: Number,
  memory_percentage1: Number,
  memory_percentage2: Number,
  ignition_on_interval: Number,
  ignition_off_interval: Number,
  digital_inputs: String,
  analog_inputs: [Number],
  checksum: String,
  received_at: { type: Date, default: Date.now, index: true }
}, { collection: "gpsRawDataHealth" });

gpsRawDataHealthSchema.index({ imei: 1, received_at: -1 });

module.exports = mongoose.model("GpsRawDataHealth", gpsRawDataHealthSchema);

