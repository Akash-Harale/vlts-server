// routes/vehicleDeviceMapRoutes.js
// Routes for mapping GPS devices to vehicles

const express = require("express");
const router = express.Router();
const vehicleDeviceMapController = require("../controllers/vehicleDeviceMapController");
 const authMiddleware = require("../middleware/authMiddleware");
// POST /vehicle-device-map/:vehicleId/map-device/:deviceId
// → Map GPS device to vehicle
router.post("/assignments/gps-vehicle", authMiddleware(["map_device_to_vehicle"]),  vehicleDeviceMapController.mapDevice,
);

// GET /vehicle-device-map/:vehicleId/device
// → View mapped GPS device for a vehicle by either vehicle Id or gps device Id
router.get("/assignments/gps-vehicle/:id", authMiddleware(["read_mapped_device_to_vehicle"]), vehicleDeviceMapController.getMappedDevice);

// get all assigned gps to vehicle
router.get(
  "/assignments/gps-vehicle", authMiddleware(["read_mapped_device_to_vehicle"]), 
  vehicleDeviceMapController.getAllGPSAssignedVehicle,
);

// PUT /vehicle-device-map/:vehicleId/map-device/:deviceId
// → Update mapping (replace GPS device for a vehicle)
router.put( 
  "/assignments/gps-vehicle/:deviceId",authMiddleware(["update_mapped_device_to_vehicle"]), 
  vehicleDeviceMapController.updateMapping,
);

// DELETE /vehicle-device-map/:vehicleId/map-device/:deviceId
// → Remove GPS device mapping from a vehicle
router.delete(
  "/assignments/gps-vehicle/:deviceId", authMiddleware(["delete_mapped_device_to_vehicle"]), 
  vehicleDeviceMapController.removeMapping,
);

module.exports = router;
