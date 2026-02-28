// /models/vehicleTripsHistory.js

const mongoose = require('mongoose');


// refactor the model to store point data by
// trip_id  -- Live Vehicle Tracking assigned to a trip
// vehcile_id ---- Live Vehicle Tracking not assigned to any trip
// 
const vehicleRouteHistorySchema = new mongoose.Schema({
  vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true }, // not required
  route_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true }, 
  registration_number: { type: String, required: true },                              // not required
  route_name: { type: String },                                                       // not required
  driver_name: { type: String, required: true },                                      // not required
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  geofence_status: { type: String, enum: ['WITHIN', 'OUTSIDE'], required: true },
  timestamp: { type: Date, default: Date.now }
});

vehicleRouteHistorySchema.index({ location: '2dsphere' });

module.exports = mongoose.model('VehicleTripsHistory', vehicleRouteHistorySchema);

/*
const tripEventsHistorySchema = new mongoose.Schema({
  trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "TripHistory", required: true },

  events: [
    {
      timestamp: { type: Date, required: true },
      location: {
        type: { type: String, enum: ["Point"], required: true },
        coordinates: { type: [Number], required: true } // [lng, lat]
      },
      speed: Number,
      event_type: { type: String, enum: ["GPS", "ALERT", "STOP", "START"] },
      notes: String
    }
  ],

  archived_at: { type: Date, default: Date.now }
});

// Index for fast replay queries
tripEventsHistorySchema.index({ trip_id: 1, "events.timestamp": 1 });

*/