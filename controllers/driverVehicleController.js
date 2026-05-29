// /controllers/driverVehicleController.js

const DriverVehicleAssignment = require("../models/driverVehicleAssignment");
const Driver = require("../models/driver");
const Vehicle = require("../models/vehicle");
const logger = require("../utils/logger");
const User = require("../models/user");


// =======================================
// CREATE Assignment
// Only DriverVehicleAssignment is written → no transaction needed
// =======================================
exports.assignDriverToVehicle = async (req, res) => {
  try {
    const { driver_id, vehicle_id, from_datetime, to_datetime, instructions } = req.body;

    // Validate driver
    const driver = await User.findById(driver_id);
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Validate vehicle
    const vehicle = await Vehicle.findById(vehicle_id);
    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    const fromDate = new Date(from_datetime);
    const toDate = new Date(to_datetime);

    if (toDate <= fromDate) {
      return res.status(400).json({ error: "to_datetime must be after from_datetime" });
    }

    // Check for overlapping assignments for this driver
    const overlappingDriverAssignment = await DriverVehicleAssignment.findOne({
      driver_id,
      status: "ACTIVE",
      from_datetime: { $lt: toDate },
      to_datetime: { $gt: fromDate }
    });

    if (overlappingDriverAssignment) {
      return res.status(400).json({
        error: "Driver already assigned during this time window"
      });
    }

    // Check for overlapping assignments for this vehicle
    const overlappingVehicleAssignment = await DriverVehicleAssignment.findOne({
      vehicle_id,
      status: "ACTIVE",
      from_datetime: { $lt: toDate },
      to_datetime: { $gt: fromDate }
    });

    if (overlappingVehicleAssignment) {
      return res.status(400).json({
        error: "Vehicle already assigned to another driver during this time window"
      });
    }

    // Create assignment
    const assignment = await DriverVehicleAssignment.create({
      client_id: req.user?.client_profile_id,
      driver_id,
      vehicle_id,
      from_datetime: fromDate,
      to_datetime: toDate,
      instructions,
      status: "ACTIVE"
    });

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'create',
      'driverVehicleAssignment',
      `Driver ${driver_id} assigned to vehicle ${vehicle_id} from ${from_datetime} to ${to_datetime}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.status(201).json(assignment);
  } catch (err) {
    console.error("assignDriverToVehicle error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'driverVehicleAssignment',
      req.user?.tenant_id || null,
      req.trace_id,
      400
    );

    res.status(400).json({ error: err.message });
  }
};


// =======================================
// GET ALL
// =======================================
exports.getAllAssignments = async (req, res) => {
  console.log('driverVehicleController: getAllAssignments API: ', req.user);
  try {
    const assignments = await DriverVehicleAssignment.find({
      client_id: req.user?.client_profile_id,
    })
      .populate("driver_id", "driver_name mobile_number email_id")
      .populate("vehicle_id", "registration_number model")
      .populate("route_id", "place_from place_to");

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'driverVehicleAssignment',
      `All driver-vehicle assignments fetched, count: ${assignments.length}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json(assignments);
  } catch (err) {
    console.error("getAllAssignments error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'driverVehicleAssignment',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ error: err.message });
  }
};


// =======================================
// GET ONE
// =======================================
exports.getAssignmentById = async (req, res) => {
  console.log('driverVehicleController: getAssignmentById API: ', req.params.id);
  try {
    const assignment = await DriverVehicleAssignment.findById(req.params.id)
      .populate("driver_id", "driver_name mobile_number email_id")
      .populate("vehicle_id", "registration_number model");

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'driverVehicleAssignment',
      `Driver-vehicle assignment fetched for id: ${req.params.id}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json(assignment);
  } catch (err) {
    console.error("getAssignmentById error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'driverVehicleAssignment',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ error: err.message });
  }
};


// =======================================
// UPDATE Assignment
// Only DriverVehicleAssignment is written → no transaction needed
// =======================================
exports.updateAssignment = async (req, res) => {
  console.log('driverVehicleController: updateAssignment API: ', req.body);
  try {
    const {
      driver_id,
      vehicle_id,
      from_datetime,
      to_datetime,
      instructions,
      status,
    } = req.body;

    if (status === "ACTIVE") {
      const activeDriverAssignment = await DriverVehicleAssignment.findOne({
        driver_id,
        status: "ACTIVE",
        _id: { $ne: req.params.id },
      });

      if (activeDriverAssignment) {
        return res.status(400).json({
          error: "Driver already has another active assignment",
        });
      }

      const activeVehicleAssignment = await DriverVehicleAssignment.findOne({
        vehicle_id,
        status: "ACTIVE",
        _id: { $ne: req.params.id },
      });

      if (activeVehicleAssignment) {
        return res.status(400).json({
          error: "Vehicle already has another active assignment",
        });
      }
    }

    const updated = await DriverVehicleAssignment.findByIdAndUpdate(
      req.params.id,
      {
        driver_id,
        vehicle_id,
        from_datetime,
        to_datetime,
        instructions,
        status,
      },
      { new: true, runValidators: true },
    )
      .populate("driver_id", "driver_name mobile_number email_id")
      .populate("vehicle_id", "registration_number model");

    if (!updated) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'update',
      'driverVehicleAssignment',
      `Driver-vehicle assignment updated for id: ${req.params.id}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json(updated);
  } catch (err) {
    console.error("updateAssignment error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'driverVehicleAssignment',
      req.user?.tenant_id || null,
      req.trace_id,
      400
    );

    res.status(400).json({ error: err.message });
  }
};


// =======================================
// DELETE Assignment
// Only DriverVehicleAssignment is affected → no transaction needed
// =======================================
exports.deleteAssignment = async (req, res) => {
  try {
    const assignment = await DriverVehicleAssignment.findByIdAndDelete(
      req.params.id,
    );

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'delete',
      'driverVehicleAssignment',
      `Driver-vehicle assignment deleted for id: ${req.params.id}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json({ message: "Assignment deleted successfully" });
  } catch (err) {
    console.error("deleteAssignment error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'driverVehicleAssignment',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ error: err.message });
  }
};












// // /controllers/driverVehicleController.js

// const DriverVehicleAssignment = require("../models/driverVehicleAssignment");
// const Driver = require("../models/driver");
// const Vehicle = require("../models/vehicle");


// // =======================================
// // CREATE Assignment
// // =======================================
// /*  commented on 23/02/2026

// exports.assignDriverToVehicle = async (req, res) => {
//   try {
//     const { driver_id, vehicle_id, from_datetime, to_datetime, instructions } =
//       req.body;

//     // Validate driver
//     const driver = await Driver.findById(driver_id);
//     if (!driver) {
//       return res.status(404).json({ error: "Driver not found" });
//     }

//     // Validate vehicle
//     const vehicle = await Vehicle.findById(vehicle_id);
//     if (!vehicle) {
//       return res.status(404).json({ error: "Vehicle not found" });
//     }

//     // Business Rule 1
//     const activeDriverAssignment = await DriverVehicleAssignment.findOne({
//       driver_id,
//       status: "ACTIVE",
//     });

//     if (activeDriverAssignment) {
//       if (from_datetime < activeDriverAssignment.to_datetime) {
//         return res.status(400).json({
//         error: "Driver already assigned to another active vehicle",
//       });
//     }
//   }
//     // Create assignment
//     const assignment = await DriverVehicleAssignment.create({
//       driver_id,
//       vehicle_id,
//       from_datetime,
//       to_datetime,
//       instructions,
//       status: "ACTIVE",
//     });

//     res.status(201).json(assignment);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// };
// */


// // Create drive-vehicle assignment
// // no overlapping date ranges for both drivers and vehicles.
// /*
// Driver overlap check: Ensures the driver isn’t already assigned during the requested window.
// Vehicle overlap check: Ensures the vehicle isn’t already assigned to another driver during the requested window.
// Both checks use the overlap condition:

// existing.from < new.to AND existing.to > new.from

// Examples: 
// Driver A assigned: 09:00 → 11:00  
// New request: 10:00 → 12:00 →  Driver overlap error

// Vehicle X assigned: 08:00 → 09:30  
// New request: 09:00 → 10:00 →  Vehicle overlap error

// Driver B assigned: 11:00 → 12:00  
// New request: 12:00 → 13:00 →  Allowed (touching boundary is fine)

// */
// exports.assignDriverToVehicle = async (req, res) => {
//   try {
//     const { driver_id, vehicle_id, from_datetime, to_datetime, instructions } = req.body;

//     // Validate driver
//     const driver = await Driver.findById(driver_id);
//     if (!driver) {
//       return res.status(404).json({ error: "Driver not found" });
//     }

//     // Validate vehicle
//     const vehicle = await Vehicle.findById(vehicle_id);
//     if (!vehicle) {
//       return res.status(404).json({ error: "Vehicle not found" });
//     }

//     const fromDate = new Date(from_datetime);
//     const toDate = new Date(to_datetime);

//     if (toDate <= fromDate) {
//       return res.status(400).json({ error: "to_datetime must be after from_datetime" });
//     }

//     // Check for overlapping assignments for this driver
//     const overlappingDriverAssignment = await DriverVehicleAssignment.findOne({
//       driver_id,
//       status: "ACTIVE",
//       from_datetime: { $lt: toDate },
//       to_datetime: { $gt: fromDate }
//     });

//     if (overlappingDriverAssignment) {
//       return res.status(400).json({
//         error: "Driver already assigned during this time window"
//       });
//     }

//     // Check for overlapping assignments for this vehicle
//     const overlappingVehicleAssignment = await DriverVehicleAssignment.findOne({
//       vehicle_id,
//       status: "ACTIVE",
//       from_datetime: { $lt: toDate },
//       to_datetime: { $gt: fromDate }
//     });

//     if (overlappingVehicleAssignment) {
//       return res.status(400).json({
//         error: "Vehicle already assigned to another driver during this time window"
//       });
//     }

//     //  Create assignment
//     const assignment = await DriverVehicleAssignment.create({
//       driver_id,
//       vehicle_id,
//       from_datetime: fromDate,
//       to_datetime: toDate,
//       instructions,
//       status: "ACTIVE"
//     });

//     res.status(201).json(assignment);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// };


// // =======================================
// // GET ALL
// // =======================================
// exports.getAllAssignments = async (req, res) => {
//   try {
//     const assignments = await DriverVehicleAssignment.find()
//       .populate("driver_id", "driver_name mobile_number email_id")
//       .populate("vehicle_id", "registration_number model")   
//       .populate("route_id", "place_from place_to");
      
//     res.json(assignments);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // =======================================
// // GET ONE
// // =======================================
// exports.getAssignmentById = async (req, res) => {
//   console.log('driverVehicleController: getAssignmentById API: ', req.params.id);
//   try {
//     const assignment = await DriverVehicleAssignment.findById(req.params.id)
//       .populate("driver_id", "driver_name mobile_number email_id")
//       .populate("vehicle_id", "registration_number model");

//     if (!assignment) {
//       return res.status(404).json({ error: "Assignment not found" });
//     }

//     res.json(assignment);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // =======================================
// // UPDATE Assignment
// // =======================================
// exports.updateAssignment = async (req, res) => {
//   console.log('driverVehicleController: updateAssignment API: ', req.body);
//   try {
//     const {
//       driver_id,
//       vehicle_id,
//       from_datetime,
//       to_datetime,
//       instructions,
//       status,
//     } = req.body;

//     if (status === "ACTIVE") {
//       const activeDriverAssignment = await DriverVehicleAssignment.findOne({
//         driver_id,
//         status: "ACTIVE",
//         _id: { $ne: req.params.id },
//       });

//       if (activeDriverAssignment) {
//         return res.status(400).json({
//           error: "Driver already has another active assignment",
//         });
//       }

//       const activeVehicleAssignment = await DriverVehicleAssignment.findOne({
//         vehicle_id,
//         status: "ACTIVE",
//         _id: { $ne: req.params.id },
//       });

//       if (activeVehicleAssignment) {
//         return res.status(400).json({
//           error: "Vehicle already has another active assignment",
//         });
//       }
//     }

//     const updated = await DriverVehicleAssignment.findByIdAndUpdate(
//       req.params.id,
//       {
//         driver_id,
//         vehicle_id,
//         from_datetime,
//         to_datetime,
//         instructions,
//         status,
//       },
//       { new: true, runValidators: true },
//     )
//       .populate("driver_id", "driver_name mobile_number email_id")
//       .populate("vehicle_id", "registration_number model");

//     if (!updated) {
//       return res.status(404).json({ error: "Assignment not found" });
//     }

//     res.json(updated);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// };

// // =======================================
// // DELETE Assignment
// // =======================================
// exports.deleteAssignment = async (req, res) => {
//   try {
//     const assignment = await DriverVehicleAssignment.findByIdAndDelete(
//       req.params.id,
//     );

//     if (!assignment) {
//       return res.status(404).json({ error: "Assignment not found" });
//     }

//     res.json({ message: "Assignment deleted successfully" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };
