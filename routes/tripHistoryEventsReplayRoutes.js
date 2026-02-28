// ./routes/tripHistoryEventsReplayRoutes.js
// Date: 26 Feb 2026
// Author: Suresh Gupta
// Purpose: Defines routes for replaying trip events with chunked JSON streaming

const express = require("express");
const { param } = require("express-validator");
const router = express.Router();
const tripHistoryEventsReplayController = require("../controllers/tripHistoryEventsReplayController");

console.log("[tripHistoryEventsReplayRoutes] Initializing trip history events replay routes...");

// Replay trip events by trip ID
router.get(
  "/trip/:tripId/replay",
  [param("tripId").isMongoId().withMessage("Invalid trip ID")],
  tripHistoryEventsReplayController.replayTripEvents
);

console.log("[tripHistoryEventsReplayRoutes] Routes registered successfully.");

module.exports = router;

