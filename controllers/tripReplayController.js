const VehicleTripsHistory = require('../models/vehicleTripsHistory');
const logger = require('../utils/logger');

// Fetch trip history for a vehicle on a route
exports.getTripHistory = async (req, res) => {
  console.log('vehicleTripsHistoryController: getTripHistory: req.query:', req.query);
  try {
    const { vehicle_id, registration_number, route_id, route_name } = req.query;

    // Build query dynamically
    const query = {};
    if (vehicle_id) query.vehicle_id = vehicle_id;
    if (registration_number) query.registration_number = registration_number;
    if (route_id) query.route_id = route_id;
    if (route_name) query.route_name = route_name;

    const history = await VehicleTripsHistory.find(query).sort({ timestamp: 1 });

    if (!history || history.length === 0) {
      return res.status(404).json({ error: 'No trip history found' });
    }

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'vehicleTripsHistory',
      `Trip history fetched for query: ${JSON.stringify(query)}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json(history);
  } catch (err) {
    console.error('vehicleTripsHistoryController: getTripHistory error:', err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'vehicleTripsHistory',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ error: err.message });
  }
};











// const VehicleTripsHistory = require('../models/vehicleTripsHistory');

// // Fetch trip history for a vehicle on a route
// exports.getTripHistory = async (req, res) => {
//   try {
//     const { vehicle_id, registration_number, route_id, route_name } = req.query;

//     // Build query dynamically
//     const query = {};
//     if (vehicle_id) query.vehicle_id = vehicle_id;
//     if (registration_number) query.registration_number = registration_number;
//     if (route_id) query.route_id = route_id;
//     if (route_name) query.route_name = route_name;

//     const history = await VehicleTripsHistory.find(query).sort({ timestamp: 1 });

//     if (!history || history.length === 0) {
//       return res.status(404).json({ error: 'No trip history found' });
//     }

//     res.json(history);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };


