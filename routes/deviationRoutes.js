// /routes/deviationRoutes.js
// Deviations API → Detect deviations from route/geofence, log alerts, send email notifications.

const express = require('express');
const router = express.Router();
const deviationController = require('../controllers/deviationController');

router.post('/deviations/check', deviationController.checkDeviation);

/*
Check deviation for a given vehicle id or registration number
If the vehicle exists.
If it has a mapped route and geofence.
If it has at least one position recorded.
Then run deviation checks (route deviation + geofence exit).

POST http://localhost:3005/api/deviations/check
Content-Type: application/json

{
  "vehicle_id": "67a0f2c9e4b1a2d9f8c12345"
}

or

POST http://localhost:3005/api/deviations/check
Content-Type: application/json

{
  "registration_number": "UP32AB1234"
}

*/
router.post('/deviations/checkvehicle', deviationController.checkDeviationByVehicle);

module.exports = router;

