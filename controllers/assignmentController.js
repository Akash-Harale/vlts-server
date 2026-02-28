// /controllers/assignmentController.js
const User = require('../models/user');
const DriverVehicleAssignment = require('../models/driverVehicleAssignment');
const VehicleRouteAssignment = require('../models/trip');

exports.getDriverAssignmentDetails = async (req, res) => {
  try {
    const { user_id } = req.params;
    console.log('assignmentController: getDriverAssignmentDetails API called with user_id:', user_id);

    // Step 1: Find user and mapped driver
    const user = await User.findOne({ user_id }).populate('driver_id');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Step 2: Find active driver-vehicle assignment
    const driverVehicle = await DriverVehicleAssignment.findOne({ driver_id: user.driver_id._id, status: 'ACTIVE' })
      .populate('driver_id', 'driver_name')
      .populate('vehicle_id', 'registration_number model');
    if (!driverVehicle) return res.status(404).json({ error: 'No active vehicle assignment found for driver' });

    // Step 3: Find active vehicle-route assignment
    const vehicleRoute = await VehicleRouteAssignment.findOne({ vehicle_id: driverVehicle.vehicle_id._id, status: 'ACTIVE' })
      .populate('route_id', 'name');
    if (!vehicleRoute) return res.status(404).json({ error: 'No active route assignment found for vehicle' });

    // Step 4: Return combined details
    const response = {
      user_id: user.user_id,
      driver_id: driverVehicle.driver_id._id,
      driver_name: driverVehicle.driver_id.driver_name,
      route_id: vehicleRoute.route_id._id,
      route_name: vehicleRoute.route_id.name,
      vehicle_id: driverVehicle.vehicle_id._id,
      vehicle_regn_number: driverVehicle.vehicle_id.registration_number,
      assignment_desc: vehicleRoute.assignment_desc
    };

   /* res.json({
      user_id: user.user_id,
      driver_id: driverVehicle.driver_id._id,
      driver_name: driverVehicle.driver_id.driver_name,
      route_id: vehicleRoute.route_id._id,
      route_name: vehicleRoute.route_id.name,
      vehicle_id: driverVehicle.vehicle_id._id,
      vehicle_regn_number: driverVehicle.vehicle_id.registration_number,
      assignment_desc: vehicleRoute.assignment_desc
    }); */

    return res.json({ success: true, message: response });
  } catch (err) {
    console.error('Error in getDriverAssignmentDetails:', err);
    res.status(500).json({ error: err.message });
  }
};
