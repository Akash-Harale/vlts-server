const express = require("express");
const router = express.Router();
const helpDeskController = require("../controllers/helpDeskController");
const authMiddleware = require("../middleware/authMiddleware");

// Since all logged-in users can access the Help Desk, we use authMiddleware without specific privileges
router.post("/", authMiddleware([]), helpDeskController.createSubmission);
router.get("/mine", authMiddleware([]), helpDeskController.getMySubmissions);

module.exports = router;
