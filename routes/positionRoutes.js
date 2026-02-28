// /routes/positionRoutes.js
// Vehicle Positions API → Store GPS points, query live positions.

const express = require('express');
const router = express.Router();
const positionController = require('../controllers/positionController');

router.post('/positions', positionController.addPosition);
router.get('/positions', positionController.getLivePositions);

module.exports = router;

