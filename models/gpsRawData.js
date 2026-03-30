// models/gpsRawData.js
// Unified schema to store raw packets + parsed data
// 28 March 2026

const mongoose = require("mongoose");

const gpsRawDataSchema = new mongoose.Schema({
  imei: { type: String, index: true }, // extracted IMEI
  vendor_id: { type: String, index: true },
  data_type: {
    type: String,
    enum: ["Login", "Tracking", "Health", "Emergency", "Unknown"],
    required: true
  },
  raw_data: { type: String, required: true },   // original string
  parsed_data: { type: Object, required: true }, // parsed fields as object
  received_at: { type: Date, default: Date.now, index: true },
  processed: { type: Boolean, default: false }  // enrichment flag
});

// Indexes for faster queries
gpsRawDataSchema.index({ imei: 1, received_at: -1 });
gpsRawDataSchema.index({ vendor_id: 1, received_at: -1 });

module.exports = mongoose.model("GpsRawData", gpsRawDataSchema);
