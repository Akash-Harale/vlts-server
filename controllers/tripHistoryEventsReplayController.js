// ./controllers/tripHistoryEventsReplayController.js
// Date: 26 Feb 2026
// Author: Suresh Gupta
// Purpose: Streams trip events in chronological order with delay (chunked JSON)

const { validationResult } = require("express-validator");
const TripEventsHistory = require("../models/tripEventsHistory");
const { audit, error } = require("../utils/logger");

console.log("[tripHistoryEventsReplayController] Controller loaded.");

/**
 * Utility: handle validation errors
 */
function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("[ValidationError]", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }
}

/**
 * Replay trip events by trip ID
 * Streams events one by one with delay (chunked JSON)
 */
exports.replayTripEvents = async (req, res) => {
  if (handleValidationErrors(req, res)) return;

  try {
    const tripId = req.params.tripId;
    console.log(`[replayTripEvents] Starting replay for tripId=${tripId}`);

    const eventsHistory = await TripEventsHistory.findOne({ trip_id: tripId });
    if (!eventsHistory) {
      console.warn(`[replayTripEvents] No events found for tripId=${tripId}`);
      await audit("system", "api", "replayTripEvents", "TripEvents", `No events for trip ${tripId}`, "failed");
      return res.status(404).json({ message: "No events found" });
    }

    // Set headers for streaming response
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Transfer-Encoding", "chunked");

    // Sort events chronologically
    const events = eventsHistory.events.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    console.log(`[replayTripEvents] Found ${events.length} events for tripId=${tripId}`);

    let i = 0;
    const interval = setInterval(async () => {
      if (i >= events.length) {
        clearInterval(interval);
        res.end();
        console.log(`[replayTripEvents] Replay completed for tripId=${tripId}`);
        await audit("system", "api", "replayTripEvents", "TripEvents", `Replay completed for trip ${tripId}`, "success");
      } else {
        // Stream one event at a time
        res.write(JSON.stringify(events[i]) + "\n");
        console.log(`[replayTripEvents] Replayed event ${i + 1}/${events.length} for tripId=${tripId}`);
        i++;
      }
    }, 1000); // 1 second delay between events
  } catch (err) {
    console.error("[replayTripEvents] Error:", err);
    await error("system", "api", err, "ReplayTripEvents");
    res.status(500).json({ message: "Error replaying trip events", error: err.message });
  }
};

