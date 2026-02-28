// ./routes/tripHistoryEventsRoutes.js
// Date: 26 Feb 2026
// Author: Suresh Gupta
// Purpose: Defines routes for trip events queries

const express = require("express");
const { param, query } = require("express-validator");
const router = express.Router();
const tripHistoryEventsController = require("../controllers/tripHistoryEventsController");

console.log("[tripHistoryEventsRoutes] Initializing trip history events routes...");

// Trip events by trip ID
router.get(
  "/trip/:tripId/events",
  [param("tripId").isMongoId().withMessage("Invalid trip ID")],
  tripHistoryEventsController.getEventsByTripId
);

// Trip events by vehicle ID
router.get(
  "/vehicle/:vehicleId/events",
  [param("vehicleId").isMongoId().withMessage("Invalid vehicle ID")],
  tripHistoryEventsController.getEventsByVehicle
);

// Trip events by driver ID
router.get(
  "/driver/:driverId/events",
  [param("driverId").isMongoId().withMessage("Invalid driver ID")],
  tripHistoryEventsController.getEventsByDriver
);

// All trip events
router.get("/all/events", tripHistoryEventsController.getAllEvents);

// Trip events by date range
router.get(
  "/events/date-range",
  [
    query("startDate").isISO8601().withMessage("Invalid startDate"),
    query("endDate").isISO8601().withMessage("Invalid endDate")
  ],
  tripHistoryEventsController.getEventsByDateRange
);

console.log("[tripHistoryEventsRoutes] Routes registered successfully.");

module.exports = router;

