// routes/gpsDeviceRoutes.js
// Routes for GPS device CRUD operations

const express = require('express');
const router = express.Router();
const gpsDeviceController = require('../controllers/gpsDeviceController');

// POST /gps-devices → Add new GPS device
router.post('/', gpsDeviceController.addDevice);

// GET /gps-devices → View all GPS devices
router.get('/', gpsDeviceController.getDevices);

// GET /gps-devices/:id → View single GPS device by ID
router.get('/:id', gpsDeviceController.getDeviceById);

// PUT /gps-devices/:id → Edit GPS device by ID
router.put('/:id', gpsDeviceController.updateDevice);

// DELETE /gps-devices/:id → Delete GPS device by ID
router.delete('/:id', gpsDeviceController.deleteDevice);


// Add heartbeat route >> Device sends heartbeat ping
/*
Workflow Now

Device firmware sends heartbeat payload (IMEI, timestamp, coords, flags).
Backend API updates installed_on and resets failed_attempts.
Logs show [HEARTBEAT OK] Device SN12345 is alive at ....
Health check cron job only marks devices FAULTY if they stop pinging for >15 minutes.

POST /gps-devices/:id/heartbeat  
*/

router.post('/:id/heartbeat', gpsDeviceController.heartbeat);

module.exports = router;

