const express = require("express");
const { getAssignedVehicle } = require("../controllers/schoolDriverController");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

router.get("/vehicle", authMiddleware(["read_vehicle"]), getAssignedVehicle) 

// named export
module.exports = {
    schoolDriverRouter: router
};