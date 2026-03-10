const express = require("express");
const router = express.Router();
const telemetryController = require("../controllers/telemetryController");

router.get("/", telemetryController.getTelemetry);
router.get("/:id", telemetryController.getTelemetryById);
router.delete("/:id", telemetryController.deleteTelemetry);

module.exports = router;

