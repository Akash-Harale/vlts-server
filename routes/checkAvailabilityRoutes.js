// /routes/availabilityRoutes.js
const express = require("express");
const router = express.Router();
const checkAvailabilityController = require('../controllers/checkAvailabilityController');

// GET /api/availability?check_availability_date=2026-01-22T14:30
router.get("/vehiclebylocation", checkAvailabilityController.checkAvailability);


// Drivers availability 
router.get("/drivers", checkAvailabilityController.getAvailableDrivers);


// Vehicles availability
router.get("/vehicles", checkAvailabilityController.getAvailableVehicles);

module.exports = router;

