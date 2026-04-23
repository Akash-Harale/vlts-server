// /routes/driverVehicleRoutes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/driverVehicleController");
const assignment = require("../controllers/assignmentController");
const authMiddleware = require("../middleware/authMiddleware");

console.log("driverVehicleRoutes loaded ..");
/*
POST /api/assignments
Content-Type: application/json

{
  "driver_id": "67a0f1c2e4b1a9d123456789",
  "vehicle_id": "67a0f1c2e4b1a9d987654321"
}
*/
router.post("/driverassignments", 
  authMiddleware(["create_driver_assignment"]), controller.assignDriverToVehicle); // Create

/*
GET /api/assignments
*/
router.get("/driverassignments", authMiddleware(["read_driver_assignment"]), controller.getAllAssignments); // Read all

router.get("/driverassignments/:id", authMiddleware(["read_driver_assignment"]), controller.getAssignmentById); // Read one

// Get driver assignment - full info

router.get(
  "/driverassignments/info/:user_id",
  authMiddleware(["read_driver_assignment"]),
  assignment.getDriverAssignmentDetails,
); // Read one

/*
PUT /api/assignments/67a0f1c2e4b1a9d555555555
Content-Type: application/json

{
  "status": "INACTIVE"
}
*/
router.put("/driverassignments/:id", authMiddleware(["update_driver_assignment"]), controller.updateAssignment); // Update

/*
DELETE /api/assignments/67a0f1c2e4b1a9d555555555
*/
router.delete("/driverassignments/:id", authMiddleware(["delete_driver_assignment"]), controller.deleteAssignment); // Delete

module.exports = router;
