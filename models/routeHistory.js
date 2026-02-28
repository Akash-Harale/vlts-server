// ./models/routeHistory.js


const mongoose = require("mongoose");

const routeHistorySchema = new mongoose.Schema({
  trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "TripHistory", required: true },

  place_from: { type: String, required: true },
  place_to: { type: String, required: true },
  source: { type: [Number], required: true }, // [lng, lat]
  destination: { type: [Number], required: true }, // [lng, lat]

  geometry: {
    type: { type: String, enum: ["LineString"], required: true },
    coordinates: { type: [[Number]], required: true }
  },

  route_desc: { type: String }, // e.g. "Ghaziabad Depot → Delhi Airport"
  distance_km: Number, // computed from geometry or copied from active route
  checkpoints: [{ name: String, coordinates: [Number] }], // copied or derived

  archived_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RouteHistory', routeHistorySchema);

