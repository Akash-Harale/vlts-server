// /models/gpsRawDataLogin.js
// 26/03/2026

const mongoose = require("mongoose");

const gpsRawDataLoginSchema = new mongoose.Schema({
  raw_packet: { type: String, required: true },
  processed: { type: Boolean, default: false },
  imei: { type: String, index: true },
  vehicle_reg: { type: String, index: true },
  header: String,
  vendor_id: String,
  firmware_version: String,
  protocol_version: String,
  latitude: Number,
  latitude_dir: String,
  longitude: Number,
  longitude_dir: String,
  checksum: String,
  received_at: { type: Date, default: Date.now, index: true }
}, { collection: "gpsRawDataLogin" });

gpsRawDataLoginSchema.index({ imei: 1, received_at: -1 });

module.exports = mongoose.model("GpsRawDataLogin", gpsRawDataLoginSchema);
