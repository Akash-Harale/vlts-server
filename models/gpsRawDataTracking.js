// /models/gpsRawDataTracking.js
// 26/03/2026
const mongoose = require("mongoose");

const gpsRawDataTrackingSchema = new mongoose.Schema({
  raw_packet: { type: String, required: true },
  processed: { type: Boolean, default: false },
  imei: { type: String, index: true },
  vehicle_reg: { type: String, index: true },
  header: String,
  vendor_id: String,
  firmware_version: String,
  packet_type: String,
  message_id: Number,
  packet_status: String,
  gps_fix: Number,
  date: String,
  time: String,
  latitude: Number,
  latitude_dir: String,
  longitude: Number,
  longitude_dir: String,
  speed: Number,
  heading: Number,
  satellites: Number,
  altitude: Number,
  pdop: Number,
  hdop: Number,
  operator: String,
  ignition_status: Number,
  main_power_status: Number,
  main_voltage: Number,
  internal_battery_voltage: Number,
  emergency_status: Number,
  tamper_alert: String,
  gsm_signal_strength: Number,
  mcc: String,
  mnc: String,
  lac: String,
  cell_id: String,
  neighbours: [{
    lac: String,
    cell_id: String,
    signal_strength: Number
  }],
  digital_inputs: String,
  digital_outputs: String,
  frame_number: Number,
  analog_inputs: [Number],
  delta_distance: Number,
  ota_response: String,
  checksum: String,
  received_at: { type: Date, default: Date.now, index: true }
}, { collection: "gpsRawDataTracking" });

gpsRawDataTrackingSchema.index({ imei: 1, received_at: -1 });

module.exports = mongoose.model("GpsRawDataTracking", gpsRawDataTrackingSchema);
