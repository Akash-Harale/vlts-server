const express = require("express");
const router = express.Router();
const gpsAlertController = require("../controllers/gpsAlertController");

router.get("/", gpsAlertController.getAlerts);
router.get("/:id", gpsAlertController.getAlertById);
router.patch("/:id/acknowledge", gpsAlertController.acknowledgeAlert);
router.delete("/:id", gpsAlertController.deleteAlert);

module.exports = router;

