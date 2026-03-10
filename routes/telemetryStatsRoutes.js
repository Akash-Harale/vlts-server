const express = require("express");
const router = express.Router();
const telemetryStatsController = require("../controllers/telemetryStatsController");

router.get("/distance", telemetryStatsController.getDailyDistance);
router.get("/average-speed", telemetryStatsController.getAverageSpeed);
router.get("/idle-time", telemetryStatsController.getIdleTime);
router.get("/overspeed-count", telemetryStatsController.getOverspeedCount);

module.exports = router;
