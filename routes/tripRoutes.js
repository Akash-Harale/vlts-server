const express = require("express");
const { param, query } = require("express-validator");
const router = express.Router();
const tripController = require("../controllers/tripController");

// Create a new active trip
// POST /api/trips
router.post(
  "/trips",
  tripController.createTrip
);

// Get all active trips (summary with vehicle & driver mapping)
// GET /api/trips
router.get(
  "/trips",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1 })
  ],
  tripController.fetchTrips
);

// Get trips filtered by vehicle
// GET /api/vehicles/:vehicleId/trips
router.get(
  "/vehicles/:vehicleId/trips",
  [param("vehicleId").isMongoId().withMessage("Invalid vehicle ID")],
  tripController.fetchTripsByVehicle
);

// Get trip geometry by tripId
// GET /api/trips/:tripId/geometry
router.get(
  "/trips/:tripId/geometry",
  [param("tripId").isMongoId().withMessage("Invalid trip ID")],
  tripController.fetchRouteGeometry
);

// Get trips filtered by approval/dep/arrival status
// GET /api/trips/status
router.get(
  "/trips/status",
  [
    query("trip_approval_status").optional().isString(),
    query("trip_dep_status").optional().isString(),
    query("trip_arrival_status").optional().isString()
  ],
  tripController.fetchTripsByStatus
);

// Update trip status (approval/dep/arrival)
// PUT /api/trips/:tripId/status
router.put(
  "/trips/:tripId/status",
  [param("tripId").isMongoId().withMessage("Invalid trip ID")],
  tripController.updateTripStatus
);

module.exports = router;

