const express = require('express');
const router = express.Router();
const replayController = require('../controllers/tripReplayController');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/replay?vehicle_id=<id>&route_id=<id>
// Replay by vehicle_id + route_id OR
// Replay by registration_number + route_name
//GET http://localhost:3005/api/replay?vehicle_id=67a0f2c9e4b1a2d9f8c12345&route_id=67a0f3dce4b1a2d9f8c67890
/* 
JSON response:
[
  {
    "_id": "67a0f5e2e4b1a2d9f8c11111",
    "vehicle_id": "67a0f2c9e4b1a2d9f8c12345",
    "route_id": "67a0f3dce4b1a2d9f8c67890",
    "registration_number": "UP32AB1234",
    "route_name": "Delhi to Agra",
    "location": { "type": "Point", "coordinates": [77.2090, 28.6139] },
    "geofence_status": "WITHIN",
    "timestamp": "2026-01-22T12:30:00.000Z"
  },
  {
    "_id": "67a0f5e2e4b1a2d9f8c22222",
    "vehicle_id": "67a0f2c9e4b1a2d9f8c12345",
    "route_id": "67a0f3dce4b1a2d9f8c67890",
    "registration_number": "UP32AB1234",
    "route_name": "Delhi to Agra",
    "location": { "type": "Point", "coordinates": [77.4126, 28.6692] },
    "geofence_status": "OUTSIDE",
    "timestamp": "2026-01-22T12:45:00.000Z"
  }
]

Trip Replay API → fetches historical GPS points for a vehicle on a route.
Supports query by vehicle_id or registration_number, and route_id or route_name.
Returns ordered list of positions with geofence status.
Admin dashboard can use this to animate past trips for replay.
*/
router.get('/replay', authMiddleware(["read_trips"]), replayController.getTripHistory);

module.exports = router;


