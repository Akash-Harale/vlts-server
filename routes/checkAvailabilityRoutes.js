const express = require("express");
const router = express.Router();
const checkAvailabilityController = require('../controllers/checkAvailabilityController');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/availability?check_availability_date=2026-01-22T14:30
router.get("/vehiclebylocation", authMiddleware(), checkAvailabilityController.checkAvailability);


// Drivers availability 
router.get("/drivers", authMiddleware(), checkAvailabilityController.getAvailableDrivers);


// Vehicles availability
router.get("/vehicles", authMiddleware(), checkAvailabilityController.getAvailableVehicles);

module.exports = router;

