// /routes/vehicleRoutes.js

// Vehicles API → Register vehicles, assign drivers, list vehicles.

const express = require("express");
const router = express.Router();
const vehicleController = require("../controllers/vehicleController");
const authMiddleware = require("../middleware/authMiddleware");


router.post("/vehicles",authMiddleware(["create_vehicle"]), vehicleController.registerVehicle);
router.get("/vehicles", authMiddleware(["read_vehicle"]), vehicleController.getVehicles);

// GET /api/vehicle?vehicle_id=<id> OR ?registration_number=<reg_no>
router.get("/vehicle", authMiddleware(["read_vehicle"]), vehicleController.getVehicleById);
router.put("/vehicles/:id", authMiddleware(["update_vehicle"]), vehicleController.updateVehicle);
router.delete("/vehicles/:id", authMiddleware(["delete_vehicle"]), vehicleController.deleteVehicle);

module.exports = router;
