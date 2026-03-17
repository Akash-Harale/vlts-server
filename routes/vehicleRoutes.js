// /routes/vehicleRoutes.js

// Vehicles API → Register vehicles, assign drivers, list vehicles.

const express = require("express");
const router = express.Router();
const vehicleController = require("../controllers/vehicleController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/vehicles", authMiddleware(), vehicleController.registerVehicle);
router.get("/vehicles", vehicleController.getVehicles);

// GET /api/vehicle?vehicle_id=<id> OR ?registration_number=<reg_no>
router.get("/vehicle", authMiddleware(), vehicleController.getVehicleById);
router.put("/vehicles/:id", authMiddleware(), vehicleController.updateVehicle);
router.delete("/vehicles/:id", authMiddleware(), vehicleController.deleteVehicle);

module.exports = router;
