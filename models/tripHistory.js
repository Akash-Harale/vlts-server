// ./models/tripHistory.js
// 26/02/2026

// /models/tripHistory.js

const mongoose = require("mongoose");

const tripHistorySchema = new mongoose.Schema({
  trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" }, // original trip reference
  vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
  route_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Route",
    required: true,
  },
  departure_time: Date,
  arrival_time: Date,
  trip_arrival_status: { type: String, enum: ["INTIME", "ONTIME", "DELAYED"], required: true },
  trip_arrival_notes: String,
  max_speed: { type: Number, default: 0 },
  avg_speed: { type: Number, default: 0 },
  total_distance: { type: Number, default: 0 },
  position_name: { type: String, default: null },

  // Snapshot metadata
  assignment_desc: String,
  assigned_at: Date,

  archived_at: { type: Date, default: Date.now },
  schema_version: { type: Number, default: 1 }
});

// Indexes for analytics
tripHistorySchema.index({ vehicle_id: 1, arrival_time: -1 });
tripHistorySchema.index({ driver_id: 1, departure_time: 1 });

module.exports = mongoose.model("TripHistory", tripHistorySchema);

