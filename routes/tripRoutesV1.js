const express = require("express");
const router = express.Router();
const tripController = require("../controllers/tripController");

// Create a new trip 

/*
POST  
http://localhost:3005/api/trips

Body (raw JSON):

{
  "route": {
    "source": "Delhi Railway Station",
    "destination": "Noida Sector 18",
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [77.2090, 28.6139],
        [77.5000, 28.4000],
        [78.0081, 27.1767]
      ]
    }
  },
  "departureTime": "2026-02-18T09:00:00.000Z",
  "arrivalTime": "2026-02-18T09:30:00.000Z",
  "vehicleId": "67b456789abcdef012345678",
  "assignment_desc": "Morning shuttle"
}

Response:
{
  "success": true,
  "message": "Vehicle assigned to route successfully",
  "data": {
    "route": {
      "_id": "67b123e4f9a8c2d345678901",
      "name": "Delhi Railway Station → Noida Sector 18",
      "source": [77.2090, 28.6139],
      "destination": [78.0081, 27.1767]
    },
    "assignment": {
      "_id": "67b9999999abcdef012345678",
      "vehicle_id": "67b456789abcdef012345678",
      "route_id": "67b123e4f9a8c2d345678901",
      "assignment_desc": "Morning shuttle",
      "status": "ACTIVE",
      "assigned_at": "2026-02-18T09:00:00.000Z"
    },
    "vehicleState": {
      "_id": "67b8888888abcdef012345678",
      "vehicle_id": "67b456789abcdef012345678",
      "place_of_availability": "Noida Sector 18",
      "next_available_date": "2026-02-18T09:30:00.000Z",
      "status": "ACTIVE"
    }
  }
}
*/
router.post(
  "/trips/create",
  tripController.createTrip
);

// Get all trips with sumamry data - vehcile and driver mapping
router.get(
  "/trips/",
  tripController.fetchTrips,
);

// Get all trips with sumamry data - trips filtered by vehicle
router.get(
  "/trips/vehicle",
  tripController.fetchTripsByVehicle,
);

// Get by trip_id -  Fetch route geometry for a given tripId
router.get("/trips/:tripId", tripController.fetchRouteGeometry);

// Fetch trips by trip_approval_status
router.get("/trips/status/", tripController.fetchTripsByStatus);

// Update trip_approval/dep/arrival_status of trips
router.put("/trips/status", tripController.updateTripStatus);

module.exports = router;

