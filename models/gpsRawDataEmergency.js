// /models/gpsRawDataEmergency.js
// 26/03/2026

const mongoose = require("mongoose");

const gpsRawDataEmergencySchema = new mongoose.Schema({
  raw_packet: { type: String, required: true },
  processed: { type: Boolean, default: false },
  imei: { type: String, index: true },
  vehicle_reg: { type: String, index: true },
  header: String,
  vendor_id: String,
  message_type: String,
  packet_type: String,
  datetime: String,
  gps_validity: String,
  latitude: Number,
  latitude_dir: String,
  longitude: Number,
  longitude_dir: String,
  altitude: Number,
  speed: Number,
  distance: Number,
  provider: String,
  reply_number: String,
  lac: String,
  cell_id: String,
  checksum: String,
  received_at: { type: Date, default: Date.now, index: true }
}, { collection: "gpsRawDataEmergency" });

gpsRawDataEmergencySchema.index({ imei: 1, received_at: -1 });

module.exports = mongoose.model("GpsRawDataEmergency", gpsRawDataEmergencySchema);
