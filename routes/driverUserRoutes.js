// /routes/driverUserRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/driverUserController');

// GET /api/drivers-with-user
// GET http://localhost:3000/api/drivers-with-user
/*
JSON Response:

[
  {
    "user_id": "driver001",
    "driver_id": "67a0f1c2e4b1a9d123456789",
    "driver_name": "Ramesh Kumar",
    "mobile_number": "9876543210",
    "email_id": "ramesh.kumar@example.com",
    "created_at": "2026-01-24T12:00:00.000Z"
  },
  {
    "user_id": "driver002",
    "driver_id": "67a0f1c2e4b1a9d987654321",
    "driver_name": "Suresh Gupta",
    "mobile_number": "9123456780",
    "email_id": "suresh.gupta@example.com",
    "created_at": "2026-01-24T12:05:00.000Z"
  }
]

*/
router.get('/driverswithuserid', controller.getAllDriversWithUserId);

module.exports = router;
