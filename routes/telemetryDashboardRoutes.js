const express = require("express");
const router = express.Router();
const telemetryDashboardController = require("../controllers/telemetryDashboardController");

router.get("/",
     telemetryDashboardController.getDashboardStats);

module.exports = router;

