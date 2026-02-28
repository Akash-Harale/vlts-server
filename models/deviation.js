// /models/deviation.js
// Date: 22 Jan 2026
// Author: Suresh Gupta

const mongoose = require('mongoose');

const deviationSchema = new mongoose.Schema({
  vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  route_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
  geofence_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Geofence' },
  position_id: { type: mongoose.Schema.Types.ObjectId, ref: 'VehiclePosition' },
  alert_type: { type: String, enum: ['ROUTE_DEVIATION', 'GEOFENCE_EXIT'], required: true },
  reason: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Deviation', deviationSchema);

