// ./routes/tripHistoryRoutes.js
// Date: 26 Feb 2026
// Author: Suresh Gupta
// Purpose: Defines routes for summary-level trip history queries



// ./routes/tripHistoryRoutes.js
const express = require("express");
const { param, query } = require("express-validator");
const router = express.Router();
const tripHistoryController = require("../controllers/tripHistoryController");

// Get all completed trips (optionally filter by date range)
router.get(
  "/trips-history",
  [
    query("startDate").optional().isISO8601().withMessage("Invalid startDate"),
    query("endDate").optional().isISO8601().withMessage("Invalid endDate")
  ],
  tripHistoryController.getAllTrips
);

// Get completed trip by ID
router.get(
  "/trips-history/:tripId",
  [param("tripId").isMongoId().withMessage("Invalid trip ID")],
  tripHistoryController.getTripById
);

// Get route geometry for a completed trip
router.get(
  "/trips-history/:tripId/geometry",
  [param("tripId").isMongoId().withMessage("Invalid trip ID")],
  tripHistoryController.fetchRouteGeometry
);

// Get completed trips by vehicle
router.get(
  "/vehicles/:vehicleId/trips-history",
  [param("vehicleId").isMongoId().withMessage("Invalid vehicle ID")],
  tripHistoryController.getTripsByVehicle
);

// Get completed trips by driver
router.get(
  "/drivers/:driverId/trips-history",
  [param("driverId").isMongoId().withMessage("Invalid driver ID")],
  tripHistoryController.getTripsByDriver
);

module.exports = router;


/*
const express = require("express");
const { param, query } = require("express-validator");
const router = express.Router();
const tripHistoryController = require("../controllers/tripHistoryController");

console.log("[tripHistoryRoutes] Initializing trip history routes...");

// Trip summary by trip ID
router.get(
  "/trip-history/:tripId",
  [param("tripId").isMongoId().withMessage("Invalid trip ID")],
  tripHistoryController.getTripById
);

// Trips by vehicle ID
router.get(
  "/trip-history/vehicle/:vehicleId",
  [param("vehicleId").isMongoId().withMessage("Invalid vehicle ID")],
  tripHistoryController.getTripsByVehicle
);

// Trips by driver ID
router.get(
  "/trip-history/driver/:driverId",
  [param("driverId").isMongoId().withMessage("Invalid driver ID")],
  tripHistoryController.getTripsByDriver
);

// All trips
router.get("/trip-history", tripHistoryController.getAllTrips);

// Trips by date range
router.get(
  "/trip-history/date-range/",
  [
    query("startDate").isISO8601().withMessage("Invalid startDate"),
    query("endDate").isISO8601().withMessage("Invalid endDate")
  ],
  tripHistoryController.getTripsByDateRange
);


// Get by trip_id -  Fetch route geometry for a given tripId
router.get("/trip-history/:tripId", tripHistoryController.fetchRouteGeometry);

console.log("[tripHistoryRoutes] Routes registered successfully.");

module.exports = router;

*/
