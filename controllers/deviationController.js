// /controllers/deviationController.js
// Deviations API → Detect deviations from route/geofence, log alerts, send email notifications.

const Deviation = require('../models/deviation');
const VehiclePosition = require('../models/vehiclePosition');
const Vehicle = require('../models/vehicle');
const Route = require('../models/route');
const Geofence = require('../models/geofence');
const { sendAlert } = require('../services/alertService');
const turf = require('@turf/turf');


// Detect deviation  
// User Imputs: position_id, route_id, geofence_id

exports.checkDeviation = async (req, res) => {
  try {
    const { position_id, route_id, geofence_id } = req.body;

    const position = await VehiclePosition.findById(position_id).populate('vehicle_id');
    const route = await Route.findById(route_id);
    const geofence = await Geofence.findById(geofence_id);

    let alertType = null;
    let reason = null;

    // Check route deviation
    if (route) {
      const line = turf.lineString(route.geometry.coordinates);
      const pt = turf.point(position.location.coordinates);
      const distance = turf.pointToLineDistance(pt, line, { units: 'meters' });
      if (distance > 50) { // threshold
        alertType = 'ROUTE_DEVIATION';
        reason = `Vehicle deviated ${distance.toFixed(2)}m from route`;
      }
    }

    // Check geofence exit
    if (geofence) {
      const poly = turf.polygon(geofence.geometry.coordinates);
      const pt = turf.point(position.location.coordinates);
      if (!turf.booleanPointInPolygon(pt, poly)) {
        alertType = 'GEOFENCE_EXIT';
        reason = 'Vehicle exited geofence';
      }
    }

    if (alertType) {
      const deviation = new Deviation({
        vehicle_id: position.vehicle_id._id,
        route_id,
        geofence_id,
        position_id,
        alert_type: alertType,
        reason
      });
      await deviation.save();

      // Send email alert
      await sendAlert({
        type: 'error',
        subject: `Deviation Alert: ${alertType}`,
        message: `Vehicle ${position.vehicle_id.registration_number} - ${reason}`
      });

      return res.status(201).json(deviation);
    }

    res.json({ message: 'No deviation detected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



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

// Check deviation by vehicle_id or registration_number
exports.checkDeviationByVehicle = async (req, res) => {
try {
    console.log('req.body:', req.body);
    const { vehicle_id, registration_number } = req.body;
    
    // 1. Find vehicle either by ID or registration number
    let vehicle;
    if (vehicle_id) {
      vehicle = await Vehicle.findById(vehicle_id);
    } else if (registration_number) {
      vehicle = await Vehicle.findOne({ registration_number });
    }

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // 2. Find latest position for this vehicle
    const position = await VehiclePosition.findOne({ vehicle_id: vehicle._id })
      .sort({ timestamp: -1 });
    if (!position) {
      return res.status(404).json({ error: 'No position data found for vehicle' });
    }

    // 3. Find mapped route & geofence (for PoC, just pick one route + geofence)
    const route = await Route.findOne({});
    const geofence = await Geofence.findOne({ route_id: route?._id });

    if (!route || !geofence) {
      return res.status(404).json({ error: 'No route/geofence mapping found for vehicle' });
    }

    let alertType = null;
    let reason = null;

    // 4a. Check route deviation
    const line = turf.lineString(route.geometry.coordinates);
    const pt = turf.point(position.location.coordinates);
    const distance = turf.pointToLineDistance(pt, line, { units: 'meters' });
    if (distance > 50) { // threshold
      alertType = 'ROUTE_DEVIATION';
      reason = `Vehicle deviated ${distance.toFixed(2)}m from route`;
    }

    // 4b. Check geofence exit
    const poly = turf.polygon(geofence.geometry.coordinates);
    if (!turf.booleanPointInPolygon(pt, poly)) {
      alertType = 'GEOFENCE_EXIT';
      reason = 'Vehicle exited geofence';
    }

    // 5. Log deviation + send alert
    if (alertType) {
      const deviation = new Deviation({
        vehicle_id: vehicle._id,
        route_id: route._id,
        geofence_id: geofence._id,
        position_id: position._id,
        alert_type: alertType,
        reason
      });
      await deviation.save();

      await sendAlert({
        type: 'error',
        subject: `Deviation Alert: ${alertType}`,
        message: `Vehicle ${vehicle.registration_number} - ${reason}`
      });

      return res.status(201).json(deviation);
    }

    res.json({ message: 'No deviation detected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
