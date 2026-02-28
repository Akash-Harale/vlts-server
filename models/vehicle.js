// /routes/vehicle.js
// Date: 22 Jan 2026
// Author: Suresh Gupta

const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema({
  make: { type: String },
  model: { type: String },
  registration_number: { type: String, required: true, unique: true },
  manufacturing_year: { type: Number },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Vehicle", vehicleSchema);
