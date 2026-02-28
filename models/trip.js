// /models/trip.js
const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema({
  vehicle_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    required: true,
  },
  route_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Route",
    required: true,
  },
  driver_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
    required: true, // or true, if you want it mandatory
  },
  departure_time: { type: Date, default: null },
  arrival_time: { type: Date, default: null },
  assignment_desc: { type: String },
  assigned_at: { type: Date, default: Date.now },
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  trip_approval_status: { type: String, enum: ["APPROVED", "AWAITED", "CANCELLED"], default: "AWAITED" },
  trip_dep_status: { type: String, enum: ["DEPARTED", "AWAITED", "CANCELLED"], default: "AWAITED" },
  trip_arrival_status: { type: String, enum: ["INTIME", "ONTIME", "DELAYED", "AWAITED"], default: "AWAITED" },
  trip_actual_arrival_time: { type: Date, default: null },
  trip_arrival_notes: { type: String }
});

// Prevent duplicate vehicle–route pair
tripSchema.index(
  { vehicle_id: 1, route_id: 1 },
  { unique: true },
);

tripSchema.index(
  { departure_time: 1 }
);

tripSchema.index(
  { arrival_time: 1 }
);

module.exports = mongoose.model(
  "Trip",
  tripSchema,
);
