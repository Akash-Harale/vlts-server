// /controllers/vehicleAvailabilityController.js
const VehicleState = require("../models/vehicleState");
const Vehicle = require("../models/vehicle");
const DriverVehicleAssignment = require("../models/driverVehicleAssignment");
const Driver = require("../models/driver");

// Check available vehicles for a given location within given data range
exports.checkAvailability = async (req, res) => {
  try {
    console.log("vehicleAvailabilityController: checkAvailability:", req.query);

    const {
      availability_place,
      departure_date,
      arrival_date
    } = req.query;

    if (!departure_date || !arrival_date) {
      return res.status(400).json({ error: "departure_date and arrival_date are required" });
    }

    const depDate = new Date(departure_date);
    const arrDate = new Date(arrival_date);

    if (isNaN(depDate.getTime()) || isNaN(arrDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    if (arrDate <= depDate) {
      return res.status(400).json({ error: "arrival_date must be after departure_date" });
    }

    // Step 1: Find vehicles available at place and time
    const availableStates = await VehicleState.find({
      place_of_availability: availability_place,
      next_available_date: { $lte: depDate },
      status: "ACTIVE"
    }).populate("vehicle_id", "registration_number make model");

    console.log("vehicleAvailabilityController: availableStates:", availableStates);

    // Step 2: For each vehicle, check driver mapping and availability
    const results = [];
    for (const vs of availableStates) {
      const driverAssignment = await DriverVehicleAssignment.findOne({
        vehicle_id: vs?.vehicle_id?._id,
        status: "ACTIVE",
        from_datetime: { $lte: depDate },
        to_datetime: { $gte: arrDate }
      }).populate("driver_id", "name license_number");

      if (driverAssignment) {
        results.push({
          vehicleId: vs.vehicle_id._id,
          registration_number: vs.vehicle_id.registration_number,
          make: vs.vehicle_id.make,
          model: vs.vehicle_id.model,
          place_of_availability: vs.place_of_availability,
          next_available_date: vs.next_available_date,
          driverId: driverAssignment.driver_id._id,
          driverName: driverAssignment.driver_id.name
        });
      } else {
        //  Ensure driver fields are present even if no mapping found
        results.push({
          vehicleId: vs?.vehicle_id?._id,
          registration_number: vs?.vehicle_id?.registration_number,
          make: vs?.vehicle_id?.make,
          model: vs?.vehicle_id?.model,
          place_of_availability: vs?.place_of_availability,
          next_available_date: vs?.next_available_date,
          driverId: null,
          driverName: null
        });
      }
    }

    console.log("vehicleAvailabilityController: results:", results);

    res.json(results);
  } catch (err) {
    console.error("Error checking availability:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};



// Check availability of Drivers and Vehicles

// 24/02/2026

// Fetch available drivers available in a given date range, excluding those already booked
/*

Key Logic
Accepts from_date and to_date as query params.
Finds all active assignments that overlap with the requested window.
Collects their driver_ids.
Queries the Driver collection for drivers not in that list.
Returns available drivers with basic info.

GET /api/availableDrivers?from_date=2026-02-18T09:00:00Z&to_date=2026-02-18T11:00:00Z

Response:
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "67b5555555abcdef012345678",
      "driver_name": "Ramesh Kumar",
      "mobile_number": "9876543210",
      "email_id": "ramesh@example.com"
    },
    {
      "_id": "67b6666666abcdef012345678",
      "driver_name": "Anita Sharma",
      "mobile_number": "9123456780",
      "email_id": "anita@example.com"
    }
  ]
}

*/
exports.getAvailableDrivers = async (req, res) => {
  console.log('driverController: getAvailableDrivers: req.params:', req.query);
  try {
    const { from_date, to_date } = req.query;

    if (!from_date || !to_date) {
      return res.status(400).json({
        success: false,
        message: "Please provide from_date and to_date"
      });
    }

    const fromDate = new Date(from_date);
    const toDate = new Date(to_date);

    if (toDate <= fromDate) {
      return res.status(400).json({
        success: false,
        message: "to_date must be after from_date"
      });
    }

    // Find drivers who have overlapping assignments in this window
    const busyAssignments = await DriverVehicleAssignment.find({
      status: "ACTIVE",
      from_datetime: { $lt: toDate },
      to_datetime: { $gt: fromDate }
    }).select("driver_id");

    const busyDriverIds = busyAssignments.map(a => a.driver_id);

    //  Find drivers not in busyDriverIds
    const availableDrivers = await Driver.find({
      _id: { $nin: busyDriverIds }
    }).select("driver_name mobile_number email_id");

    res.status(200).json({
      success: true,
      count: availableDrivers.length,
      data: availableDrivers
    });
  } catch (err) {
    console.error("getAvailableDrivers error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};



// Fetch available vehicles for a given date range
// Date 23/02/2026
/*
Accepts from_date and to_date as query params.
Finds all active assignments overlapping with the requested window.
Collects their vehicle_ids.
Queries the Vehicle collection for vehicles not in that list.
Returns available vehicles with basic info.

GET /api/availableVehicles?from_date=2026-02-18T09:30:00Z&to_date=2026-02-18T10:30:00Z

Response:
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "67v3333333abcdef012345678",
      "registration_number": "HR26CD4321",
      "make": "Ashok Leyland",
      "model": "Dost"
    }
  ]
}

*/


exports.getAvailableVehicles = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    if (!from_date || !to_date) {
      return res.status(400).json({
        success: false,
        message: "Please provide from_date and to_date"
      });
    }

    const fromDate = new Date(from_date);
    const toDate = new Date(to_date);

    if (toDate <= fromDate) {
      return res.status(400).json({
        success: false,
        message: "to_date must be after from_date"
      });
    }

    // Step 1: Get all vehicles
    const allVehicles = await Vehicle.find().select("registration_number make model");

    // Step 2: Find vehicles with overlapping assignments in this window
    const busyAssignments = await DriverVehicleAssignment.find({
      status: "ACTIVE",
      from_datetime: { $lt: toDate },
      to_datetime: { $gt: fromDate }
    }).select("vehicle_id");

    const busyVehicleIds = busyAssignments.map(a => a.vehicle_id.toString());

    // Step 3: Filter out busy vehicles
    const freeVehicles = allVehicles.filter(
      v => !busyVehicleIds.includes(v._id.toString())
    );

    // Step 4: Attach VehicleState info
    const freeVehicleIds = freeVehicles.map(v => v._id);
    const vehicleStates = await VehicleState.find({
      vehicle_id: { $in: freeVehicleIds }
    }).select("vehicle_id place_of_availability next_available_date status");

    const enrichedVehicles = freeVehicles.map(v => {
      const state = vehicleStates.find(
        vs => vs.vehicle_id.toString() === v._id.toString()
      );
      return {
        _id: v._id,
        registration_number: v.registration_number,
        make: v.make,
        model: v.model,
        availability: state
          ? {
              place_of_availability: state.place_of_availability,
              next_available_date: state.next_available_date,
              status: state.status
            }
          : null
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedVehicles.length,
      data: enrichedVehicles
    });
  } catch (err) {
    console.error("getAvailableVehicles error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};


/*
exports.getAvailableVehicles = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    if (!from_date || !to_date) {
      return res.status(400).json({
        success: false,
        message: "Please provide from_date and to_date"
      });
    }

    const fromDate = new Date(from_date);
    const toDate = new Date(to_date);

    if (toDate <= fromDate) {
      return res.status(400).json({
        success: false,
        message: "to_date must be after from_date"
      });
    }

    // Step 1: Get all vehicles
    const allVehicles = await Vehicle.find().select("registration_number make model");

    // Step 2: Find vehicles with overlapping assignments in this window
    const busyAssignments = await DriverVehicleAssignment.find({
      status: "ACTIVE",
      from_datetime: { $lt: toDate },
      to_datetime: { $gt: fromDate }
    }).select("vehicle_id");

    const busyVehicleIds = busyAssignments.map(a => a.vehicle_id.toString());

    // Step 3: Filter out busy vehicles
    const availableVehicles = allVehicles.filter(
      v => !busyVehicleIds.includes(v._id.toString())
    );

    res.status(200).json({
      success: true,
      count: availableVehicles.length,
      data: availableVehicles
    });
  } catch (err) {
    console.error("getAvailableVehicles error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
*/

