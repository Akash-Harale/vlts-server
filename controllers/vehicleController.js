// controllers/vehicleController.js
// Vehicles API → Register vehicles, assign drivers, list vehicles.

const mongoose = require("mongoose");
const Vehicle = require("../models/vehicle");
const VehicleState = require("../models/vehicleState");
const DriverVehicleAssignment = require("../models/driverVehicleAssignment");
const logger = require("../utils/logger");

const MAX_RETRIES = parseInt(process.env.TRANSACTION_MAX_RETRIES || "3", 10);
const BASE_DELAY_MS = parseInt(process.env.TRANSACTION_BACKOFF_MS || "100", 10);

/**
 * Validate if a date string is a valid date
 * Accepts: ISO 8601 format (2026-04-22, 2026-04-22T10:30:00Z) or timestamp
 */
function isValidDate(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

// ─────────────────────────────────────────────
// POST /vehicles → Register a new vehicle
// Transaction: writes to Vehicle + VehicleState (both must succeed or both rollback)
// Retry: yes
// ─────────────────────────────────────────────
exports.registerVehicle = async (req, res) => {
  const {
    client_id,
    make,
    model,
    registration_number,
    manufacturing_year,
    chassis_number,
    engine_number,
    date_of_subscription,
    regn_valid_upto,
    status,
    availability_place,
    next_available_date,
  } = req.body;

  console.log('vehicleController: registerVehicle: req.body: ', req.body);

  // ── Validate required fields (before opening a session) ──
  if (!client_id)
    return res.status(400).json({ success: false, message: "client_id is required" });
  if (!chassis_number)
    return res.status(400).json({ success: false, message: "chassis_number is required" });
  if (!engine_number)
    return res.status(400).json({ success: false, message: "engine_number is required" });
  if (!date_of_subscription)
    return res.status(400).json({ success: false, message: "date_of_subscription is required" });
  if (!regn_valid_upto)
    return res.status(400).json({ success: false, message: "regn_valid_upto is required" });
  if (!next_available_date)
    return res.status(400).json({ success: false, message: "next_available_date is required" });

  if (!isValidDate(date_of_subscription))
    return res.status(400).json({
      success: false,
      message: "date_of_subscription must be a valid date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)",
    });
  if (!isValidDate(regn_valid_upto))
    return res.status(400).json({
      success: false,
      message: "regn_valid_upto must be a valid date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)",
    });
  if (!isValidDate(next_available_date))
    return res.status(400).json({
      success: false,
      message: "next_available_date must be a valid date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)",
    });

  const inputDate = new Date(next_available_date);
  const today = new Date();

  if (inputDate <= today)
    return res.status(400).json({
      success: false,
      message: `next_available_date must be greater than today's date/time`,
    });

  // ── Transaction with retry ──
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();

    try {
      attempt++;

      const result = await session.withTransaction(async () => {
        // Write 1: Create Vehicle
        const vehicle = new Vehicle({
          client_id,
          make,
          model,
          registration_number,
          manufacturing_year,
          chassis_number,
          engine_number,
          date_of_subscription: new Date(date_of_subscription),
          regn_valid_upto: new Date(regn_valid_upto),
        });
        await vehicle.save({ session });

        // Write 2: Create VehicleState (must link to same vehicle)
        const vehicleState = new VehicleState({
          vehicle_id: vehicle._id,
          place_of_availability: availability_place,
          next_available_date: inputDate,
          status: status.toUpperCase(),
        });
        await vehicleState.save({ session });

        return { vehicle, vehicleState };
      });

      session.endSession();

      await logger.audit(
        req.user?.employee_id?._id?.toString() || "SYSTEM",
        req.user?.employee_id?.name || "SYSTEM",
        req.user?.role || "unknown",
        "create",
        "vehicle",
        `Vehicle ${registration_number} (${chassis_number}) registered successfully`,
        "success",
        req.user?.tenant_id || null,
        req.trace_id
      );

      return res.status(201).json({
        success: true,
        message: "Vehicle created successfully",
        vehicle: result.vehicle,
        availability_place,
        next_available_date,
        status,
      });

    } catch (err) {
      session.endSession();

      // Retry on transient errors
      if (
        err.errorLabels &&
        (err.errorLabels.includes("TransientTransactionError") ||
          err.errorLabels.includes("UnknownTransactionCommitResult"))
      ) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        if (attempt < MAX_RETRIES) {
          console.warn(`vehicleController: registerVehicle: retry attempt ${attempt} in ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      console.log('vehicleController: registerVehicle: error: ', err.message);
      await logger.error(
        req.user?.employee_id?._id?.toString() || "SYSTEM",
        req.user?.employee_id?.name || "SYSTEM",
        req.user?.role || "unknown",
        err,
        "vehicle",
        req.user?.tenant_id || null,
        req.trace_id,
        500
      );
      return res.status(500).json({ error: err.message });
    }
  }
};


// ─────────────────────────────────────────────
// GET /vehicles → Get all vehicles
// No transaction needed — reads only
// ─────────────────────────────────────────────
exports.getVehicles = async (req, res) => {
  try {
    const states = await VehicleState.find().populate("vehicle_id");

    const result = states.map((vs) => ({
      vehicleId: vs?.vehicle_id?._id,
      client_id: vs?.vehicle_id?.client_id,
      registration_number: vs?.vehicle_id?.registration_number,
      make: vs?.vehicle_id?.make,
      model: vs?.vehicle_id?.model,
      manufacturing_year: vs?.vehicle_id?.manufacturing_year,
      chassis_number: vs?.vehicle_id?.chassis_number,
      engine_number: vs?.vehicle_id?.engine_number,
      date_of_subscription: vs?.vehicle_id?.date_of_subscription,
      regn_valid_upto: vs?.vehicle_id?.regn_valid_upto,
      place_of_availability: vs?.place_of_availability,
      next_available_date: vs?.next_available_date,
      status: vs?.status,
    }));

    await logger.audit(
      req.user?.employee_id?._id?.toString() || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      "read",
      "vehicle",
      `Retrieved ${result.length} vehicles`,
      "success",
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json(result);
  } catch (err) {
    await logger.error(
      req.user?.employee_id?._id?.toString() || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      err,
      "vehicle",
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────
// GET /vehicles/:id → Get vehicle by ID or registration number
// No transaction needed — reads only
// ─────────────────────────────────────────────
exports.getVehicleById = async (req, res) => {
  try {
    const { vehicle_id, registration_number } = req.query;

    let vehicle;
    if (vehicle_id) {
      vehicle = await Vehicle.findById(vehicle_id);
    } else if (registration_number) {
      vehicle = await Vehicle.findOne({ registration_number });
    } else {
      return res.status(400).json({ error: "Provide either vehicle_id or registration_number" });
    }

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    const vehicleState = await VehicleState.findOne({ vehicle_id: vehicle._id });

    await logger.audit(
      req.user?.employee_id?._id?.toString() || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      "read",
      "vehicle",
      `Retrieved vehicle ${vehicle.registration_number}`,
      "success",
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json({
      vehicleId: vehicle._id,
      client_id: vehicle.client_id,
      registration_number: vehicle.registration_number,
      make: vehicle.make,
      model: vehicle.model,
      manufacturing_year: vehicle.manufacturing_year,
      chassis_number: vehicle.chassis_number,
      engine_number: vehicle.engine_number,
      date_of_subscription: vehicle.date_of_subscription,
      regn_valid_upto: vehicle.regn_valid_upto,
      place_of_availability: vehicleState?.place_of_availability,
      next_available_date: vehicleState ? vehicleState.next_available_date : null,
      status: vehicleState?.status,
    });
  } catch (err) {
    await logger.error(
      req.user?.employee_id?._id?.toString() || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      err,
      "vehicle",
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────
// PUT /vehicles/:id → Update vehicle
// Transaction: updates Vehicle + VehicleState (both must succeed or both rollback)
// Retry: yes
// ─────────────────────────────────────────────
exports.updateVehicle = async (req, res) => {
  const { id } = req.params;
  const {
    status,
    availability_place,
    next_available_date,
    date_of_subscription,
    regn_valid_upto,
    ...updateData
  } = req.body;

  let vehicle_status;
  if (status) { vehicle_status = status.toUpperCase(); }

  // ── Validate dates before opening session ──
  if (date_of_subscription) {
    if (!isValidDate(date_of_subscription))
      return res.status(400).json({
        success: false,
        message: "date_of_subscription must be a valid date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)",
      });
    updateData.date_of_subscription = new Date(date_of_subscription);
  }

  if (regn_valid_upto) {
    if (!isValidDate(regn_valid_upto))
      return res.status(400).json({
        success: false,
        message: "regn_valid_upto must be a valid date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)",
      });
    updateData.regn_valid_upto = new Date(regn_valid_upto);
  }

  let inputDate;
  if (next_available_date) {
    if (!isValidDate(next_available_date))
      return res.status(400).json({
        success: false,
        message: "next_available_date must be a valid date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)",
      });

    inputDate = new Date(next_available_date);
    const today = new Date();

    if (inputDate <= today)
      return res.status(400).json({
        success: false,
        message: `next_available_date must be greater than today's date/time`,
      });
  }

  // ── Transaction with retry ──
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();

    try {
      attempt++;

      const result = await session.withTransaction(async () => {
        // Write 1: Update Vehicle document
        const updatedVehicle = await Vehicle.findByIdAndUpdate(
          id,
          { $set: updateData },
          { new: true, runValidators: true, omitUndefined: true, session }
        );

        if (!updatedVehicle) {
          const err = new Error("Vehicle not found");
          err.statusCode = 404;
          throw err;
        }

        // Write 2: Update VehicleState (only if next_available_date provided)
        let updatedState = null;
        if (next_available_date) {
          const vehicleState = await VehicleState.findOne({ vehicle_id: id }).session(session);
          if (!vehicleState) {
            const err = new Error("Vehicle state not found");
            err.statusCode = 404;
            throw err;
          }

          updatedState = await VehicleState.findOneAndUpdate(
            { vehicle_id: id },
            {
              status: vehicle_status,
              place_of_availability: availability_place,
              next_available_date: inputDate,
            },
            { new: true, session }
          );
        }

        return { updatedVehicle, updatedState };
      });

      session.endSession();

      await logger.audit(
        req.user?.employee_id?._id?.toString() || "SYSTEM",
        req.user?.employee_id?.name || "SYSTEM",
        req.user?.role || "unknown",
        "update",
        "vehicle",
        `Vehicle updated successfully`,
        "success",
        req.user?.tenant_id || null,
        req.trace_id
      );

      return res.status(200).json({
        success: true,
        message: "Vehicle updated successfully",
    
      });

    } catch (err) {
      session.endSession();

      // 404 — don't retry, just respond
      if (err.statusCode === 404) {
        return res.status(404).json({ success: false, message: err.message });
      }

      // Retry on transient errors
      if (
        err.errorLabels &&
        (err.errorLabels.includes("TransientTransactionError") ||
          err.errorLabels.includes("UnknownTransactionCommitResult"))
      ) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        if (attempt < MAX_RETRIES) {
          console.warn(`vehicleController: updateVehicle: retry attempt ${attempt} in ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      console.error("Update vehicle error:", err);
      await logger.error(
        req.user?.employee_id?._id?.toString() || "SYSTEM",
        req.user?.employee_id?.name || "SYSTEM",
        req.user?.role || "unknown",
        err,
        "vehicle",
        req.user?.tenant_id || null,
        req.trace_id,
        500
      );
      return res.status(500).json({
        success: false,
        message: "Failed to update vehicle",
        error: err.message,
      });
    }
  }
};


// ─────────────────────────────────────────────
// DELETE /vehicles/:id → Delete vehicle
// Transaction: deletes Vehicle + VehicleState (both must succeed or both rollback)
// Retry: yes
// ─────────────────────────────────────────────
exports.deleteVehicle = async (req, res) => {
  const { id } = req.params;

  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();

    try {
      attempt++;

      const result = await session.withTransaction(async () => {
        // Read 1: Verify vehicle exists
        const vehicle = await Vehicle.findById(id).session(session);
        if (!vehicle) {
          const err = new Error("Vehicle not found");
          err.statusCode = 404;
          throw err;
        }

        // Read 2: Verify vehicle state exists
        const vehicleState = await VehicleState.findOne({ vehicle_id: id }).session(session);
        if (!vehicleState) {
          const err = new Error("Vehicle state not found");
          err.statusCode = 404;
          throw err;
        }

        const today = new Date();

        // Business rule: only allow delete if vehicle is not on trip
        if (vehicleState.next_available_date >= today) {
          const err = new Error(`Vehicle is on trip, next available date: ${vehicleState.next_available_date}`);
          err.statusCode = 400;
          throw err;
        }

        // Write 1: Delete Vehicle
        await Vehicle.findByIdAndDelete(id, { session });

        // Write 2: Delete VehicleState
        await VehicleState.deleteOne({ vehicle_id: id }, { session });

        return { vehicle, vehicleState };
      });

      session.endSession();

      await logger.audit(
        req.user?.employee_id?._id?.toString() || "SYSTEM",
        req.user?.employee_id?.name || "SYSTEM",
        req.user?.role || "unknown",
        "delete",
        "vehicle",
        `Vehicle ${result.vehicle.registration_number} (${result.vehicle.chassis_number}) deleted successfully`,
        "success",
        req.user?.tenant_id || null,
        req.trace_id
      );

      return res.status(200).json({
        success: true,
        message: "Vehicle deleted successfully",
        next_available_date: result.vehicleState.next_available_date,
      });

    } catch (err) {
      session.endSession();

      // 404 / 400 — don't retry, respond immediately
      if (err.statusCode === 404) {
        return res.status(404).json({ success: false, message: err.message });
      }
      if (err.statusCode === 400) {
        return res.status(400).json({ success: false, message: err.message });
      }

      // Retry on transient errors
      if (
        err.errorLabels &&
        (err.errorLabels.includes("TransientTransactionError") ||
          err.errorLabels.includes("UnknownTransactionCommitResult"))
      ) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        if (attempt < MAX_RETRIES) {
          console.warn(`vehicleController: deleteVehicle: retry attempt ${attempt} in ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      console.error("Delete vehicle error:", err);
      await logger.error(
        req.user?.employee_id?._id?.toString() || "SYSTEM",
        req.user?.employee_id?.name || "SYSTEM",
        req.user?.role || "unknown",
        err,
        "vehicle",
        req.user?.tenant_id || null,
        req.trace_id,
        500
      );
      return res.status(500).json({
        success: false,
        message: "Failed to delete vehicle",
        error: err.message,
      });
    }
  }
};








// // /controllers/vehicleController.js
// // Vehicles API → Register vehicles, assign drivers, list vehicles.

// const Vehicle = require("../models/vehicle");
// const VehicleState = require("../models/vehicleState");
// const DriverVehicleAssignment = require("../models/driverVehicleAssignment");
// const logger = require("../utils/logger");

// /**
//  * Validate if a date string is a valid date
//  * Accepts: ISO 8601 format (2026-04-22, 2026-04-22T10:30:00Z) or timestamp
//  */
// function isValidDate(dateString) {
//   if (!dateString) return false;
//   const date = new Date(dateString);
//   return date instanceof Date && !isNaN(date);
// }

// // CREATE Vehicle
// exports.registerVehicle = async (req, res) => {
//   try {
//     const {
//       client_id,
//       make,
//       model,
//       registration_number,
//       manufacturing_year,
//       chassis_number,
//       engine_number,
//       date_of_subscription,
//       regn_valid_upto,
//       status,
//       availability_place,
//       next_available_date,
//     } = req.body;

//     console.log('vehicleController: registerVehicle: req.body: ', req.body);

//     // Validate required new fields
//     if (!client_id) {
//       return res.status(400).json({ success: false, message: "client_id is required" });
//     }
//     if (!chassis_number) {
//       return res.status(400).json({ success: false, message: "chassis_number is required" });
//     }
//     if (!engine_number) {
//       return res.status(400).json({ success: false, message: "engine_number is required" });
//     }
//     if (!date_of_subscription) {
//       return res.status(400).json({ success: false, message: "date_of_subscription is required" });
//     }
//     if (!regn_valid_upto) {
//       return res.status(400).json({ success: false, message: "regn_valid_upto is required" });
//     }
//     if (!next_available_date) {
//       return res.status(400).json({ success: false, message: "next_available_date is required" });
//     }

//     // Validate date formats
//     if (!isValidDate(date_of_subscription)) {
//       return res.status(400).json({
//         success: false,
//         message: "date_of_subscription must be a valid date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)",
//       });
//     }
//     if (!isValidDate(regn_valid_upto)) {
//       return res.status(400).json({
//         success: false,
//         message: "regn_valid_upto must be a valid date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)",
//       });
//     }
//     if (!isValidDate(next_available_date)) {
//       return res.status(400).json({
//         success: false,
//         message: "next_available_date must be a valid date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)",
//       });
//     }

//     const inputDate = new Date(next_available_date);
//     const today = new Date();

//     if (inputDate <= today) {
//       return res.status(400).json({
//         success: false,
//         message: `next_available_date must be greater than today's date/time`,
//       });
//     }

//     const vehicle = new Vehicle({
//       client_id,
//       make,
//       model,
//       registration_number,
//       manufacturing_year,
//       chassis_number,
//       engine_number,
//       date_of_subscription: new Date(date_of_subscription),
//       regn_valid_upto: new Date(regn_valid_upto),
//     });
//     await vehicle.save();

//     const vehicleState = new VehicleState({
//       vehicle_id: vehicle._id,
//       place_of_availability: availability_place,
//       next_available_date: inputDate,
//       status: status.toUpperCase(),
//     });
//     await vehicleState.save();

//     // Audit log for successful vehicle registration
//     await logger.audit(
//       req.user?.employee_id?._id?.toString() || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       "create",
//       "vehicle",
//       `Vehicle ${registration_number} (${chassis_number}) registered successfully`,
//       "success",
//       req.user?.tenant_id || null,
//       req.trace_id
//     );

//     res.status(201).json({
//       success: true,
//       message: "Vehicle created successfully",
//       vehicle,
//       availability_place,
//       next_available_date,
//       status,
//     });
//   } catch (err) {
//     console.log('vehicleController: registerVehicle: error: ', err.message);
    
//     // Error log for failed vehicle registration
//     await logger.error(
//       req.user?.employee_id?._id?.toString() || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       err,
//       "vehicle",
//       req.user?.tenant_id || null,
//       req.trace_id,
//       500
//     );
    
//     res.status(500).json({ error: err.message });
//   }
// };


// // Get all vehicles (include next_available_date)
// exports.getVehicles = async (req, res) => {
//   try {
//     const states = await VehicleState.find().populate("vehicle_id");

//     const result = states.map((vs) => ({
//       vehicleId: vs?.vehicle_id?._id,
//       client_id: vs?.vehicle_id?.client_id,
//       registration_number: vs?.vehicle_id?.registration_number,
//       make: vs?.vehicle_id?.make,
//       model: vs?.vehicle_id?.model,
//       manufacturing_year: vs?.vehicle_id?.manufacturing_year,
//       chassis_number: vs?.vehicle_id?.chassis_number,
//       engine_number: vs?.vehicle_id?.engine_number,
//       date_of_subscription: vs?.vehicle_id?.date_of_subscription,
//       regn_valid_upto: vs?.vehicle_id?.regn_valid_upto,
//       place_of_availability: vs?.place_of_availability,
//       next_available_date: vs?.next_available_date,
//       status: vs?.status,
//     }));

//     // Audit log for successful vehicle retrieval
//     await logger.audit(
//       req.user?.employee_id?._id?.toString() || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       "read",
//       "vehicle",
//       `Retrieved ${result.length} vehicles`,
//       "success",
//       req.user?.tenant_id || null,
//       req.trace_id
//     );

//     res.json(result);
//   } catch (err) {
//     // Error log for failed vehicle retrieval
//     await logger.error(
//       req.user?.employee_id?._id?.toString() || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       err,
//       "vehicle",
//       req.user?.tenant_id || null,
//       req.trace_id,
//       500
//     );
    
//     res.status(500).json({ error: err.message });
//   }
// };


// // Get vehicle by ID or registration number (include next_available_date)
// exports.getVehicleById = async (req, res) => {
//   try {
//     const { vehicle_id, registration_number } = req.query;

//     let vehicle;
//     if (vehicle_id) {
//       vehicle = await Vehicle.findById(vehicle_id);
//     } else if (registration_number) {
//       vehicle = await Vehicle.findOne({ registration_number });
//     } else {
//       return res.status(400).json({ error: "Provide either vehicle_id or registration_number" });
//     }

//     if (!vehicle) {
//       return res.status(404).json({ error: "Vehicle not found" });
//     }

//     const vehicleState = await VehicleState.findOne({ vehicle_id: vehicle._id });

//     // Audit log for successful vehicle retrieval
//     await logger.audit(
//       req.user?.employee_id?._id?.toString() || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       "read",
//       "vehicle",
//       `Retrieved vehicle ${vehicle.registration_number}`,
//       "success",
//       req.user?.tenant_id || null,
//       req.trace_id
//     );

//     res.json({
//       vehicleId: vehicle._id,
//       client_id: vehicle.client_id,
//       registration_number: vehicle.registration_number,
//       make: vehicle.make,
//       model: vehicle.model,
//       manufacturing_year: vehicle.manufacturing_year,
//       chassis_number: vehicle.chassis_number,
//       engine_number: vehicle.engine_number,
//       date_of_subscription: vehicle.date_of_subscription,
//       regn_valid_upto: vehicle.regn_valid_upto,
//       place_of_availability: vehicleState?.place_of_availability,
//       next_available_date: vehicleState ? vehicleState.next_available_date : null,
//       status: vehicleState?.status,
//     });
//   } catch (err) {
//     // Error log for failed vehicle retrieval
//     await logger.error(
//       req.user?.employee_id?._id?.toString() || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       err,
//       "vehicle",
//       req.user?.tenant_id || null,
//       req.trace_id,
//       500
//     );
    
//     res.status(500).json({ error: err.message });
//   }
// };


// // UPDATE Vehicle
// exports.updateVehicle = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const {
//       status,
//       availability_place,
//       next_available_date,
//       date_of_subscription,
//       regn_valid_upto,
//       ...updateData
//     } = req.body;

//     let vehicle_status;
//     if (status) { vehicle_status = status.toUpperCase(); }

//     // Validate and parse date fields if provided
//     if (date_of_subscription) {
//       if (!isValidDate(date_of_subscription)) {
//         return res.status(400).json({
//           success: false,
//           message: "date_of_subscription must be a valid date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)",
//         });
//       }
//       updateData.date_of_subscription = new Date(date_of_subscription);
//     }
//     if (regn_valid_upto) {
//       if (!isValidDate(regn_valid_upto)) {
//         return res.status(400).json({
//           success: false,
//           message: "regn_valid_upto must be a valid date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)",
//         });
//       }
//       updateData.regn_valid_upto = new Date(regn_valid_upto);
//     }

//     const updatedVehicle = await Vehicle.findByIdAndUpdate(
//       id,
//       { $set: updateData },
//       { new: true, runValidators: true, omitUndefined: true }
//     );

//     if (!updatedVehicle) {
//       return res.status(404).json({ success: false, message: "Vehicle not found" });
//     }

//     if (next_available_date) {
//       if (!isValidDate(next_available_date)) {
//         return res.status(400).json({
//           success: false,
//           message: "next_available_date must be a valid date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)",
//         });
//       }

//       const inputDate = new Date(next_available_date);
//       const today = new Date();

//       if (inputDate <= today) {
//         return res.status(400).json({
//           success: false,
//           message: `next_available_date must be greater than today's date/time`,
//         });
//       }

//       const vehicleState = await VehicleState.findOne({ vehicle_id: id });
//       if (!vehicleState) {
//         return res.status(404).json({ success: false, message: "Vehicle state not found" });
//       }

//       const updatedState = await VehicleState.findOneAndUpdate(
//         { vehicle_id: id },
//         {
//           status: vehicle_status,
//           place_of_availability: availability_place,
//           next_available_date: inputDate,
//         },
//         { new: true }
//       );

//       // Audit log for successful vehicle update
//       await logger.audit(
//         req.user?.employee_id?._id?.toString() || "SYSTEM",
//         req.user?.employee_id?.name || "SYSTEM",
//         req.user?.role || "unknown",
//         "update",
//         "vehicle",
//         `Vehicle ${updatedVehicle.registration_number} updated successfully`,
//         "success",
//         req.user?.tenant_id || null,
//         req.trace_id
//       );

//       return res.status(200).json({
//         success: true,
//         message: "Vehicle updated successfully",
//         data: {
//           vehicle: updatedVehicle,
//           place_of_availability: updatedState.place_of_availability,
//           next_available_date: updatedState.next_available_date,
//           status: updatedState.status,
//         },
//       });
//     }

//     // Audit log for successful vehicle update
//     await logger.audit(
//       req.user?.employee_id?._id?.toString() || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       "update",
//       "vehicle",
//       `Vehicle ${updatedVehicle.registration_number} updated successfully`,
//       "success",
//       req.user?.tenant_id || null,
//       req.trace_id
//     );

//     return res.status(200).json({
//       success: true,
//       message: "Vehicle updated successfully",
//       data: {
//         vehicle: updatedVehicle,
//         next_available_date: null,
//       },
//     });
//   } catch (err) {
//     console.error("Update vehicle error:", err);
    
//     // Error log for failed vehicle update
//     await logger.error(
//       req.user?.employee_id?._id?.toString() || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       err,
//       "vehicle",
//       req.user?.tenant_id || null,
//       req.trace_id,
//       500
//     );
    
//     return res.status(500).json({
//       success: false,
//       message: "Failed to update vehicle",
//       error: err.message,
//     });
//   }
// };


// // DELETE Vehicle
// exports.deleteVehicle = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // Step 1: Check if vehicle exists
//     const vehicle = await Vehicle.findById(id);
//     if (!vehicle) {
//       return res.status(404).json({ success: false, message: "Vehicle not found" });
//     }

//     // Step 2: Find VehicleState record
//     const vehicleState = await VehicleState.findOne({ vehicle_id: id });
//     if (!vehicleState) {
//       return res.status(404).json({ success: false, message: "Vehicle state not found" });
//     }

//     const today = new Date();

//     // Step 3: Allow delete only if next_available_date < today
//     if (vehicleState.next_available_date < today) {
//       await Vehicle.findByIdAndDelete(id);
//       await VehicleState.deleteOne({ vehicle_id: id });

//       // Audit log for successful vehicle deletion
//       await logger.audit(
//         req.user?.employee_id?._id?.toString() || "SYSTEM",
//         req.user?.employee_id?.name || "SYSTEM",
//         req.user?.role || "unknown",
//         "delete",
//         "vehicle",
//         `Vehicle ${vehicle.registration_number} (${vehicle.chassis_number}) deleted successfully`,
//         "success",
//         req.user?.tenant_id || null,
//         req.trace_id
//       );

//       return res.status(200).json({
//         success: true,
//         message: "Vehicle deleted successfully",
//         next_available_date: vehicleState.next_available_date,
//       });
//     } else {
//       return res.status(400).json({
//         success: false,
//         message: `Vehicle is on trip, next available date: ${vehicleState.next_available_date}`,
//       });
//     }
//   } catch (err) {
//     console.error("Delete vehicle error:", err);
    
//     // Error log for failed vehicle deletion
//     await logger.error(
//       req.user?.employee_id?._id?.toString() || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       err,
//       "vehicle",
//       req.user?.tenant_id || null,
//       req.trace_id,
//       500
//     );
    
//     return res.status(500).json({
//       success: false,
//       message: "Failed to delete vehicle",
//       error: err.message,
//     });
//   }
// };