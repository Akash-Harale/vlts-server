// 26/02/2026
// ./mode;s/tripEventsHistory.js

const mongoose = require("mongoose");

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

module.exports = mongoose.model("TripEventsHistory", tripEventsHistorySchema);

