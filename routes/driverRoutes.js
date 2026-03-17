
// /routes/driverRoutes.js
const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const authMiddleware = require('../middleware/authMiddleware');

/*
POST /api/drivers
Content-Type: application/json

{
  "driver_name": "Ramesh Kumar",
  "mobile_number": "9876543210",
  "email_id": "ramesh.kumar@example.com",
  "user_id": "driver001",
  "password": "securePass123"
}

RESPONSE:

{
  "message": "Driver and User created successfully",
  "driver": {
    "_id": "67a0f1c2e4b1a9d123456789",
    "driver_name": "Ramesh Kumar",
    "mobile_number": "9876543210",
    "email_id": "ramesh.kumar@example.com",
    "created_at": "2026-01-24T10:15:00.000Z"
  },
  "user": {
    "user_id": "driver001",
    "driver_id": "67a0f1c2e4b1a9d123456789"
  }
}
*/
router.post('/drivers', authMiddleware(), driverController.createDriver);       // Create

/*
GET /api/drivers
*/
router.get('/drivers', authMiddleware(), driverController.getAllDrivers);       // Read all

/*
GET /api/drivers/67a0f1c2e4b1a9d123456789
*/
router.get('/drivers/:id', authMiddleware(), driverController.getDriverById);   // Read one

/*
PUT /api/drivers/67a0f1c2e4b1a9d123456789
Content-Type: application/json

{
  "driver_name": "Ramesh Kumar Updated",
  "mobile_number": "9876543210",
  "email_id": "ramesh.updated@example.com"
}
*/
router.put('/drivers/:id', authMiddleware(), driverController.updateDriver);    // Update

/*
DELETE /api/drivers/67a0f1c2e4b1a9d123456789
*/
router.delete('/drivers/:id', authMiddleware(), driverController.deleteDriver); // Delete

module.exports = router;

