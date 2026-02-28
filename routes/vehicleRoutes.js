// /routes/vehicleRoutes.js

// Vehicles API → Register vehicles, assign drivers, list vehicles.

const express = require("express");
const router = express.Router();
const vehicleController = require("../controllers/vehicleController");

router.post("/vehicles", vehicleController.registerVehicle);
router.get("/vehicles", vehicleController.getVehicles);

// GET /api/vehicle?vehicle_id=<id> OR ?registration_number=<reg_no>
router.get("/vehicle", vehicleController.getVehicleById);
router.put("/vehicles/:id", vehicleController.updateVehicle);
router.delete("/vehicles/:id", vehicleController.deleteVehicle);

module.exports = router;
