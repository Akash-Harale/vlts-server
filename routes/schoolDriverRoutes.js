const express = require("express");
const { getAssignedVehicle } = require("../controllers/schoolDriverController");
const authMiddleware = require("../middleware/authMiddleware");
const { createTempRoute, getTempRoute, updateTempRoute, deleteTempRoute } = require("../controllers/temp_route.controller");
const router = express.Router();

router.get("/vehicle", authMiddleware(["read_vehicle"]), getAssignedVehicle)
// get assigned temp routes
router.get("/temp-route", authMiddleware(["read_temp_route"]), getTempRoute)

// school admin
router.post("/temp-route", authMiddleware(["create_temp_route"]), createTempRoute)
router.put("/temp-route/:route_id", authMiddleware(["update_temp_route"]), updateTempRoute)
router.delete("/temp-route/:route_id", authMiddleware(["delete_temp_route"]), deleteTempRoute)

// named export
module.exports = {
    schoolDriverRouter: router
};