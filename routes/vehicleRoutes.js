// /routes/vehicleRoutes.js

// Vehicles API → Register vehicles, assign drivers, list vehicles.

const express = require("express");
const router = express.Router();
const vehicleController = require("../controllers/vehicleController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/",authMiddleware(["create_vehicle"]), vehicleController.registerVehicle);
router.get("/", authMiddleware(["read_vehicle"]), vehicleController.getVehicles);

// GET /api/vehicle?vehicle_id=<id> OR ?registration_number=<reg_no>
router.get("/:id", authMiddleware(["read_vehicle"]), vehicleController.getVehicleById);
router.put("/:id", authMiddleware(["update_vehicle"]), vehicleController.updateVehicle);
router.delete("/:id", authMiddleware(["delete_vehicle"]), vehicleController.deleteVehicle);

module.exports = router;
