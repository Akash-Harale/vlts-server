// /routes/route.js
// Date: 22 Jan 2026
// Author: Suresh Gupta

const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  place_from: { type: String, required: true },
  place_to: { type: String, required: true },
  source: { type: [Number], required: true }, // [lng, lat]
  destination: { type: [Number], required: true },
  geometry: {
    type: {
      type: String,
      enum: ['LineString'],
      required: true
    },
    coordinates: { type: [[Number]], required: true }
  },
  created_at: { type: Date, default: Date.now }
});

routeSchema.index({ geometry: '2dsphere' });

module.exports = mongoose.model('Route', routeSchema);

