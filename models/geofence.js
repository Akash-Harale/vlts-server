// /routes/geofence.js
// Date: 22 Jan 2026
// Author: Suresh Gupta

const mongoose = require('mongoose');

const geofenceSchema = new mongoose.Schema({
  route_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  radius: { type: Number, required: true }, // meters
  geometry: {
    type: {
      type: String,
      enum: ['Polygon'],
      required: true
    },
    coordinates: { type: [[[Number]]], required: true }
  },
  created_at: { type: Date, default: Date.now }
});

geofenceSchema.index({ geometry: '2dsphere' });

module.exports = mongoose.model('Geofence', geofenceSchema);
