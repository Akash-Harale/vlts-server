// controllers/vehicleDeviceMapController.js
// Handles mapping GPS devices to vehicles with debug logs

const mongoose = require("mongoose");
const GPSDevice = require("../models/gpsDevice");
const VehicleDeviceMap = require("../models/vehicleDeviceMap");
const Vehicle = require("../models/vehicle");
const logger = require("../utils/logger");

const MAX_RETRIES = parseInt(process.env.TRANSACTION_MAX_RETRIES || "3", 10);
const BASE_DELAY_MS = parseInt(process.env.TRANSACTION_BACKOFF_MS || "100", 10);

// ─────────────────────────────────────────────
// POST /vehicle-device-map → Map a GPS device to a vehicle
// Transaction: VehicleDeviceMap.save() + device.save() (failed_attempts increment)
//              Both writes must commit together or rollback
// Retry: yes
// ─────────────────────────────────────────────
exports.mapDevice = async (req, res) => {
  const { gps_device_id, vehicle_id, technician_id, installation_date, installation_notes } = req.body;

  console.log("[DEBUG] Attempting to map device:", gps_device_id, "to vehicle:", vehicle_id);

  if (!gps_device_id || !vehicle_id) {
    return res.status(400).json({ error: "Both gps_device_id and vehicle_id are required" });
  }

  const meta = {
    emp_id: req.user?.employee_id?._id?.toString() || "SYSTEM",
    emp_name: req.user?.employee_id?.name || "SYSTEM",
    role: req.user?.role || "unknown",
    tenant_id: req.user?.tenant_id || null,
    trace_id: req.headers['x-request-id'] || req.trace_id || null
  };

  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();
    let savedMapping;

    try {
      attempt++;

      await session.withTransaction(async () => {
        const vehicle = await Vehicle.findById(vehicle_id).session(session);
        if (!vehicle) {
          const err = new Error("Vehicle not found");
          err.statusCode = 404;
          throw err;
        }

        const device = await GPSDevice.findById(gps_device_id).session(session);
        if (!device) {
          const err = new Error("GPS Device not found");
          err.statusCode = 404;
          throw err;
        }

        if (!device.canBeMapped()) {
          device.failed_attempts += 1;
          await device.save({ session });

          const err = new Error(`Device ${device.serial_number || device.imei} is ${device.status} and cannot be mapped`);
          err.statusCode = 400;
          err.auditMessage = `Failed to map device ${device.serial_number || device.imei} to vehicle ${vehicle.registration_number}`;
          throw err;
        }

        const existing = await VehicleDeviceMap.findOne({ gps_device_id }).session(session);
        if (existing && existing.status === "MAPPED") {
          const err = new Error("Device already mapped");
          err.statusCode = 409;
          err.auditMessage = `Device ${device.serial_number || device.imei} already mapped`;
          throw err;
        }

        const mapping = new VehicleDeviceMap({
          vehicle_id,
          gps_device_id,
          technician_id,
          installation_date,
          installation_notes,
        });

        await mapping.save({ session });

        mapping._deviceLabel = device.serial_number || device.imei;
        mapping._vehicleLabel = vehicle.registration_number;

        savedMapping = mapping;
      });

      session.endSession();

      await logger.audit(
        meta.emp_id,
        meta.emp_name,
        meta.role,
        "create",
        "vehicle_device_map",
        `Device ${savedMapping._deviceLabel} mapped to vehicle ${savedMapping._vehicleLabel}`,
        "success",
        meta.tenant_id,
        meta.trace_id
      );

      return res.status(201).json(savedMapping);

    } catch (err) {
      session.endSession();

      if (err.statusCode === 404 || err.statusCode === 400 || err.statusCode === 409) {
        await logger.audit(
          meta.emp_id,
          meta.emp_name,
          meta.role,
          "create",
          "vehicle_device_map",
          err.auditMessage || err.message,
          "failed",
          meta.tenant_id,
          meta.trace_id
        );

        return res.status(err.statusCode).json({ error: err.message });
      }

      if (err.errorLabels && (err.errorLabels.includes("TransientTransactionError") || err.errorLabels.includes("UnknownTransactionCommitResult"))) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      await logger.error(meta.emp_id, meta.emp_name, meta.role, err, "vehicle_device_map", meta.tenant_id, meta.trace_id, 500);

      return res.status(500).json({ error: err.message });
    }
  }
};


// ─────────────────────────────────────────────
// GET /vehicle-device-map/all → View all mapped GPS devices with vehicles
// No transaction needed — reads only
// ─────────────────────────────────────────────
exports.getAllGPSAssignedVehicle = async (req, res) => {
  console.log(" [DEBUG] Fetching all mapped GPS devices with vehicles");
  try {
    const gpsAssignedVehicles = await VehicleDeviceMap.find({ status: "MAPPED" })
      .populate("gps_device_id")
      .populate("vehicle_id");

    if (!gpsAssignedVehicles || gpsAssignedVehicles.length === 0) {
      console.warn(" [WARN] No mapped devices found");
      return res.status(404).json([]);
    }

    console.log(" [DEBUG] Total mappings found:", gpsAssignedVehicles.length);
    res.json(gpsAssignedVehicles);
  } catch (err) {
    console.error(" [ERROR] GetAllGPSAssignedVehicle failed:", err.message);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────
// GET /vehicle-device-map/:id/device → View mapped GPS device for a vehicle or device ID
// No transaction needed — reads only
// ─────────────────────────────────────────────
exports.getMappedDevice = async (req, res) => {
  const { id } = req.params;
  console.log(" [DEBUG] Fetching mapped device for ID:", id);

  try {
    let mapping = await VehicleDeviceMap.findOne({ vehicle_id: id, status: "MAPPED" })
      .populate("gps_device_id")
      .populate("vehicle_id");

    if (!mapping) {
      mapping = await VehicleDeviceMap.findOne({ gps_device_id: id, status: "MAPPED" })
        .populate("gps_device_id")
        .populate("vehicle_id");
    }

    if (!mapping) {
      console.warn(" [WARN] No mapped device found for ID:", id);
      return res.status(404).json([]);
    }

    console.log(" [DEBUG] Mapping found:", {
      mapping_id: mapping._id,
      vehicle_id: mapping.vehicle_id?._id,
      gps_device_id: mapping.gps_device_id?._id,
      status: mapping.status,
    });

    res.json([mapping]);
  } catch (err) {
    console.error(" [ERROR] GetMappedDevice failed:", err.message);
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────
// PUT /vehicle-device-map/map-device/:deviceId → Replace GPS device mapping for a vehicle
// Transaction: updateMany (unmap old) + findOneAndUpdate (create new mapping)
//              All 3 writes must commit together or rollback
// Retry: yes
// ─────────────────────────────────────────────
exports.updateMapping = async (req, res) => {
  const { deviceId } = req.params;
  const { vehicle_id, technician_id, installation_date, installation_notes } = req.body;

  console.log(" [DEBUG] Updating mapping:", deviceId, vehicle_id);

  const meta = {
    emp_id: req.user?.employee_id?._id?.toString() || "SYSTEM",
    emp_name: req.user?.employee_id?.name || "SYSTEM",
    role: req.user?.role || "unknown",
    tenant_id: req.user?.tenant_id || null,
    trace_id: req.headers['x-request-id'] || req.trace_id || null
  };

  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();
    let updatedMapping;

    try {
      attempt++;

      await session.withTransaction(async () => {
        await VehicleDeviceMap.updateMany(
          { vehicle_id, status: "MAPPED" },
          { status: "UNMAPPED", unmapped_on: new Date() },
          { session }
        );

        await VehicleDeviceMap.updateMany(
          { gps_device_id: deviceId, status: "MAPPED" },
          { status: "UNMAPPED", unmapped_on: new Date() },
          { session }
        );

        const mapping = await VehicleDeviceMap.findOneAndUpdate(
          { vehicle_id, gps_device_id: deviceId },
          {
            vehicle_id,
            gps_device_id: deviceId,
            technician_id,
            installation_date,
            installation_notes,
            status: "MAPPED",
          },
          { upsert: true, new: true, session }
        ).populate("gps_device_id").populate("vehicle_id");

        if (!mapping) {
          const err = new Error("Mapping update failed");
          err.statusCode = 404;
          throw err;
        }

        updatedMapping = mapping;
      });

      session.endSession();

      await logger.audit(
        meta.emp_id,
        meta.emp_name,
        meta.role,
        "update",
        "vehicle_device_map",
        `Mapping updated for vehicle ${vehicle_id}`,
        "success",
        meta.tenant_id,
        meta.trace_id
      );

      return res.json([updatedMapping]);

    } catch (err) {
      session.endSession();

      if (err.statusCode === 404) {
        await logger.audit(
          meta.emp_id,
          meta.emp_name,
          meta.role,
          "update",
          "vehicle_device_map",
          "Mapping update failed",
          "failed",
          meta.tenant_id,
          meta.trace_id
        );

        return res.status(404).json([]);
      }

      if (err.errorLabels && (err.errorLabels.includes("TransientTransactionError") || err.errorLabels.includes("UnknownTransactionCommitResult"))) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      await logger.error(meta.emp_id, meta.emp_name, meta.role, err, "vehicle_device_map", meta.tenant_id, meta.trace_id, 500);

      return res.status(400).json({ error: err.message });
    }
  }
};


// ─────────────────────────────────────────────
// DELETE /vehicle-device-map/map-device/:deviceId → Remove GPS device mapping
// Transaction: findOneAndUpdate (status → UNMAPPED)
//              Single write, wrapped for consistency and future extensibility
// Retry: yes
// ─────────────────────────────────────────────
exports.removeMapping = async (req, res) => {
  const { deviceId } = req.params;
  console.log(" [DEBUG] Removing mapping for device:", deviceId);

  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();

    try {
      attempt++;

      const mapping = await session.withTransaction(async () => {
        // Write 1: Mark mapping as UNMAPPED
        const mapping = await VehicleDeviceMap.findOneAndUpdate(
          { gps_device_id: deviceId, status: "MAPPED" },
          { status: "UNMAPPED", unmapped_on: new Date() },
          { new: true, session }
        )
          .populate("gps_device_id")
          .populate("vehicle_id");

        if (!mapping) {
          const err = new Error("Mapping not found");
          err.statusCode = 404;
          throw err;
        }

        console.log(" [DEBUG] Mapping removed:", {
          mapping_id: mapping._id,
          vehicle_id: mapping.vehicle_id?._id,
          gps_device_id: mapping.gps_device_id?._id,
          status: mapping.status,
        });

        return mapping;
      });

      session.endSession();

      return res.json([mapping]);

    } catch (err) {
      session.endSession();

      // 404 — no retry
      if (err.statusCode === 404) {
        console.warn(" [WARN] Mapping not found for removal:", deviceId);
        return res.status(404).json([]);
      }

      // Retry on transient errors
      if (
        err.errorLabels &&
        (err.errorLabels.includes("TransientTransactionError") ||
          err.errorLabels.includes("UnknownTransactionCommitResult"))
      ) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        if (attempt < MAX_RETRIES) {
          console.warn(` [RETRY] removeMapping attempt ${attempt} failed, retrying in ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      console.error(" [ERROR] RemoveMapping failed:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }
};








// // controllers/vehicleDeviceMapController.js
// // Handles mapping GPS devices to vehicles with debug logs

// const GPSDevice = require("../models/gpsDevice");
// const VehicleDeviceMap = require("../models/vehicleDeviceMap");
// const Vehicle = require("../models/vehicle");
// const logger = require("../utils/logger");

// // POST /vehicle-device-map/:vehicleId/map-device/:deviceId
// // → Map a GPS device to a vehicle

// // Assuming route is something like: POST /api/assignments/map or POST /api/gps/assign
// exports.mapDevice = async (req, res) => {
//   console.log(
//     "[DEBUG] Attempting to map device:",
//     req.body.gps_device_id,
//     "to vehicle:",
//     req.body.vehicle_id,
//   );

//   try {
//     const { gps_device_id, vehicle_id, technician_id, installation_date, installation_notes } =
//       req.body;

//     // Validate required fields
//     if (!gps_device_id || !vehicle_id) {
//       return res
//         .status(400)
//         .json({ error: "Both gps_device_id and vehicle_id are required" });
//     }

//     // Validate vehicle exists
//     const vehicle = await Vehicle.findById(vehicle_id);
//     if (!vehicle) {
//       console.warn("[WARN] Vehicle not found:", vehicle_id);
//       return res.status(404).json({ error: "Vehicle not found" });
//     }

//     // Validate GPS device exists
//     const device = await GPSDevice.findById(gps_device_id);
//     if (!device) {
//       console.warn("[WARN] GPS Device not found:", gps_device_id);
//       return res.status(404).json({ error: "GPS Device not found" });
//     }

//     // Validation: only ACTIVE devices can be mapped
//     if (!device.canBeMapped()) {
//       device.failed_attempts += 1;
//       await device.save(); // may auto-mark as FAULTY
      
//       // Audit log for failed mapping (device not active)
//       await logger.audit(
//         req.user?.employee_id?._id?.toString() || "SYSTEM",
//         req.user?.employee_id?.name || "SYSTEM",
//         req.user?.role || "unknown",
//         "update",
//         "vehicle_device_map",
//         `Failed to map device ${device.serial_number || device.imei} to vehicle ${vehicle.registration_number} - Device status: ${device.status}`,
//         "failed",
//         req.user?.tenant_id || null,
//         req.trace_id
//       );

//       return res.status(400).json({
//         error: `Device ${device.serial_number || device.imei} is ${device.status} and cannot be mapped`,
//       });
//     }

//     // Optional: check if device is already mapped (prevents duplicates)
//     const existing = await VehicleDeviceMap.findOne({ gps_device_id });
//     if (existing && existing.status === 'MAPPED') {
//       // Audit log for duplicate mapping attempt
//       await logger.audit(
//         req.user?.employee_id?._id?.toString() || "SYSTEM",
//         req.user?.employee_id?.name || "SYSTEM",
//         req.user?.role || "unknown",
//         "update",
//         "vehicle_device_map",
//         `Attempted to map device ${device.serial_number || device.imei} but it's already mapped to another vehicle`,
//         "failed",
//         req.user?.tenant_id || null,
//         req.trace_id
//       );

//       return res.status(409).json({
//         error: "This GPS device is already assigned to another vehicle",
//       });
//     }

//     const mapping = new VehicleDeviceMap({
//       vehicle_id,
//       gps_device_id,
//       technician_id,
//       installation_date,
//       installation_notes
//     });

//     await mapping.save();
//     console.log("[DEBUG] Mapping saved:", mapping._id);

//     // Audit log for successful mapping
//     await logger.audit(
//       req.user?.employee_id?._id?.toString() || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       "create",
//       "vehicle_device_map",
//       `GPS device ${device.serial_number || device.imei} mapped to vehicle ${vehicle.registration_number}`,
//       "success",
//       req.user?.tenant_id || null,
//       req.trace_id
//     );

//     res.status(201).json(mapping);
//   } catch (err) {
//     console.error("[ERROR] MapDevice failed:", err.message);
    
//     // Error log for mapping failure
//     await logger.error(
//       req.user?.employee_id?._id?.toString() || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       err,
//       "vehicle_device_map",
//       req.user?.tenant_id || null,
//       req.trace_id,
//       500
//     );
    
//     res.status(500).json({ error: err.message || "Internal server error" });
//   }
// };
// // GET /vehicle-device-map/all
// // → View all mapped GPS devices with vehicles
// exports.getAllGPSAssignedVehicle = async (req, res) => {
//   console.log(" [DEBUG] Fetching all mapped GPS devices with vehicles");
//   try {
//     const gpsAssignedVehicles = await VehicleDeviceMap.find({
//       status: "MAPPED",
//     })
//       .populate("gps_device_id")
//       .populate("vehicle_id");

//     if (!gpsAssignedVehicles || gpsAssignedVehicles.length === 0) {
//       console.warn(" [WARN] No mapped devices found");
//       return res.status(404).json([]);
//     }

//     console.log(" [DEBUG] Total mappings found:", gpsAssignedVehicles.length);

//     // Always return as array
//     res.json(gpsAssignedVehicles);
//   } catch (err) {
//     console.error(" [ERROR] GetAllGPSAssignedVehicle failed:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// };

// // GET /vehicle-device-map/:id/device
// // → View mapped GPS device for a vehicle OR by deviceId
// exports.getMappedDevice = async (req, res) => {
//   const { id } = req.params;
//   console.log(" [DEBUG] Fetching mapped device for ID:", id);

//   try {
//     // Try lookup by vehicle_id first
//     let mapping = await VehicleDeviceMap.findOne({
//       vehicle_id: id,
//       status: "MAPPED",
//     })
//       .populate("gps_device_id")
//       .populate("vehicle_id");

//     // If not found, fallback to lookup by gps_device_id
//     if (!mapping) {
//       mapping = await VehicleDeviceMap.findOne({
//         gps_device_id: id,
//         status: "MAPPED",
//       })
//         .populate("gps_device_id")
//         .populate("vehicle_id");
//     }

//     if (!mapping) {
//       console.warn(" [WARN] No mapped device found for ID:", id);
//       return res.status(404).json([]);
//     }

//     console.log(" [DEBUG] Mapping found:", {
//       mapping_id: mapping._id,
//       vehicle_id: mapping.vehicle_id?._id,
//       gps_device_id: mapping.gps_device_id?._id,
//       status: mapping.status,
//     });

//     // Wrap single mapping in array for consistency
//     res.json([mapping]);
//   } catch (err) {
//     console.error(" [ERROR] GetMappedDevice failed:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// };


// // PUT /vehicle-device-map/map-device/:deviceId
// // → Replace GPS device mapping for a vehicle
// exports.updateMapping = async (req, res) => {
//   const { deviceId } = req.params;
//   const { vehicle_id, technician_id, installation_date, installation_notes } = req.body;

//   console.log(" [DEBUG] Updating mapping: replacing device:", deviceId, "for vehicle:", vehicle_id);

//   try {
//     // Step 1: Unmap any existing mapping for this vehicle
//     await VehicleDeviceMap.updateMany(
//       { vehicle_id, status: "MAPPED" },
//       { status: "UNMAPPED", unmapped_on: new Date() }
//     );

//     // Step 2: Unmap this device if it was mapped elsewhere
//     await VehicleDeviceMap.updateMany(
//       { gps_device_id: deviceId, status: "MAPPED" },
//       { status: "UNMAPPED", unmapped_on: new Date() }
//     );

//     // Step 3: Create or update mapping with new device
//     let mapping = await VehicleDeviceMap.findOneAndUpdate(
//       { vehicle_id, gps_device_id: deviceId },
//       {
//         vehicle_id,
//         gps_device_id: deviceId,
//         technician_id,
//         installation_date,
//         installation_notes,
//         status: "MAPPED",
//       },
//       { upsert: true, new: true }
//     )
//       .populate("gps_device_id")
//       .populate("vehicle_id");

//     if (!mapping) {
//       console.warn(" [WARN] Mapping update failed for vehicle:", vehicle_id);
//       return res.status(404).json([]);
//     }

//     console.log(" [DEBUG] Mapping updated:", {
//       mapping_id: mapping._id,
//       vehicle_id: mapping.vehicle_id?._id,
//       gps_device_id: mapping.gps_device_id?._id,
//       status: mapping.status,
//     });

//     // Wrap in array for consistency
//     res.json([mapping]);
//   } catch (err) {
//     console.error(" [ERROR] UpdateMapping failed:", err.message);
//     res.status(400).json({ error: err.message });
//   }
// };


// // DELETE /vehicle-device-map/map-device/:deviceId
// // → Remove GPS device mapping (vehicleId auto-resolved)
// exports.removeMapping = async (req, res) => {
//   const { deviceId } = req.params;
//   console.log(" [DEBUG] Removing mapping for device:", deviceId);

//   try {
//     const mapping = await VehicleDeviceMap.findOneAndUpdate(
//       {
//         gps_device_id: deviceId,
//         status: "MAPPED",
//       },
//       { status: "UNMAPPED", unmapped_on: new Date() },
//       { new: true }
//     )
//       .populate("gps_device_id")
//       .populate("vehicle_id");

//     if (!mapping) {
//       console.warn(" [WARN] Mapping not found for removal:", deviceId);
//       return res.status(404).json([]);
//     }

//     console.log(" [DEBUG] Mapping removed:", {
//       mapping_id: mapping._id,
//       vehicle_id: mapping.vehicle_id?._id,
//       gps_device_id: mapping.gps_device_id?._id,
//       status: mapping.status,
//     });

//     // Return as array for consistency with other APIs
//     res.json([mapping]);
//   } catch (err) {
//     console.error(" [ERROR] RemoveMapping failed:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// };

