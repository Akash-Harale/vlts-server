const express = require("express");
const { getAllAlerts, createAlert, updateAlert, updateAllAlerts, deleteAlert, deleteAllAlerts } = require("../controllers/alertController");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();

// get all alerts by vehicle id
router.get("/:vehicle_id", authMiddleware(["read_alert"]), getAllAlerts)
// create alert
router.post("/:vehicle_id", authMiddleware(["create_alert"]), createAlert)

// update alert
router.put("/:id", authMiddleware(["update_alert"]), updateAlert)
// update all   
router.put("/gps/:id", authMiddleware(["update_alert"]), updateAllAlerts)


// delete alert 
router.delete("/:id", authMiddleware(["delete_alert"]), deleteAlert)
// delete all
router.delete("/", authMiddleware(["delete_alert"]), deleteAllAlerts)


exports.alertRoutes = router;