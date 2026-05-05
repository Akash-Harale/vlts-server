// controllers/gpsDeviceController.js
// Handles CRUD operations for GPS devices with debug logs

const mongoose = require('mongoose');
const GPSDevice = require('../models/gpsDevice');
const logger = require('../utils/logger');

const MAX_RETRIES = parseInt(process.env.TRANSACTION_MAX_RETRIES || "3", 10);
const BASE_DELAY_MS = parseInt(process.env.TRANSACTION_BACKOFF_MS || "100", 10);

// ─────────────────────────────────────────────
// POST /gps-devices → Add new GPS device
// Transaction: device.save() + audit log write (if logger writes to DB)
// Wrapped because future schema hooks or related writes may extend this
// ─────────────────────────────────────────────
exports.addDevice = async (req, res) => {
  console.log(' [DEBUG] AddDevice request body:', req.body);

  const {
    imei,
    device_id,  
    icc_id,
    make,
    model,
    firmware_version,
    protocol,
    sim_provider1,
    sim_provider2,
    status,
    device_type
  } = req.body;

  // Validate required fields explicitly
  if (!imei || !device_id || !icc_id) {
    return res.status(400).json({ error: 'imei, device_id, and icc_id are required fields' });
  }

  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();

    let savedDevice; // ✅ IMPORTANT

    try {
      attempt++;

      await session.withTransaction(async () => {
        // Construct the device object with explicit fields based on new schema
        const deviceData = {
          imei,
          device_id,
          icc_id,
          make,
          model,
          firmware_version,
          protocol,
          sim_provider1,
          sim_provider2
        };

        if (status) deviceData.status = status;
        if (device_type) deviceData.device_type = device_type;

        const device = new GPSDevice(deviceData);
        await device.save({ session });

        console.log(' [DEBUG] Device saved:', device);

        savedDevice = device; // ✅ store here
      });

      session.endSession();

      // ✅ AUDIT LOG
      await logger.audit(
        req.user?.employee_id || "SYSTEM",
        req.user?.employee_id?.name || "SYSTEM",
        req.user?.role || "unknown",
        "create",
        "gps_device",
        `Device ${savedDevice.imei} created`,
        "success",
        req.user?.tenant_id || null,
        req.trace_id
      );

      // ✅ RETURN CORRECT DATA
      return res.status(201).json(savedDevice);

    } catch (err) {
      session.endSession();

      if (
        err.errorLabels &&
        (err.errorLabels.includes("TransientTransactionError") ||
          err.errorLabels.includes("UnknownTransactionCommitResult"))
      ) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        if (attempt < MAX_RETRIES) {
          console.warn(` [RETRY] AddDevice attempt ${attempt} failed, retrying in ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      console.error(' [ERROR] AddDevice failed:', err.message);

      await logger.error(
        req.user?.employee_id || "SYSTEM",
        req.user?.employee_id?.name || "SYSTEM",
        req.user?.role || "unknown",
        err,
        "gps_device",
        req.user?.tenant_id || null,
        req.trace_id,
        400
      );

      return res.status(400).json({ error: err.message });
    }
  }
};

// ─────────────────────────────────────────────
// GET /gps-devices → View all devices
// No transaction needed — single read
// ─────────────────────────────────────────────
exports.getDevices = async (req, res) => {
  console.log(' [DEBUG] Fetching all devices');
  try {
    const devices = await GPSDevice.find();
    console.log(' [DEBUG] Devices found:', devices.length);
    await logger.audit(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      "read",
      "gps_device",
      `Fetched all devices`,
      "success",
      req.user?.tenant_id || null,
      req.trace_id
    );
    res.json(devices);
  } catch (err) {
    console.error(' [ERROR] GetDevices failed:', err.message);
    await logger.error(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      err,
      "gps_device",
      req.user?.tenant_id || null,
      req.trace_id,
      400
    );
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /gps-devices/:id → View single device
// No transaction needed — single read
// ─────────────────────────────────────────────
exports.getDeviceById = async (req, res) => {
  console.log(' [DEBUG] Fetching device by ID:', req.params.id);
  try {
    const device = await GPSDevice.findById(req.params.id);
    if (!device) {
      console.warn(' [WARN] Device not found:', req.params.id);
      return res.status(404).json({ error: 'Device not found' });
    }
    await logger.audit(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      "read",
      "gps_device",
      `Fetched device ${req.params.id}`,
      "success",
      req.user?.tenant_id || null,
      req.trace_id
    );
    res.json(device);
  } catch (err) {
    console.error(' [ERROR] GetDeviceById failed:', err.message);
    await logger.error(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      err,
      "gps_device",
      req.user?.tenant_id || null,
      req.trace_id,
      400
    );
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────
// PUT /gps-devices/:id → Edit device
// No transaction needed — single document write
// ─────────────────────────────────────────────
exports.updateDevice = async (req, res) => {
  console.log(' [DEBUG] Updating device ID:', req.params.id, 'with data:', req.body);
  try {
    const device = await GPSDevice.findById(req.params.id);

    if (!device) {
      console.warn(' [WARN] Device not found for update:', req.params.id);
      return res.status(404).json({ error: 'Device not found' });
    }

    Object.assign(device, req.body);
    await device.save();

    console.log(' [DEBUG] Device updated:', {
      id: device._id,
      imei: device.imei,
      status: device.status,
    });
    await logger.audit(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      "update",
      "gps_device",
      `Updated device ${device.imei}`,
      "success",
      req.user?.tenant_id || null,
      req.trace_id
    );
    res.json({
      message: 'Device updated successfully',
      device,
    });
  } catch (err) {
    console.error(' [ERROR] UpdateDevice failed:', err.message);
    await logger.error(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      err,
      "gps_device",
      req.user?.tenant_id || null,
      req.trace_id,
      400
    );
    res.status(400).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /gps-devices/:id → Delete device
// No transaction needed — single document delete
// ─────────────────────────────────────────────
exports.deleteDevice = async (req, res) => {
  console.log(' [DEBUG] Deleting device ID:', req.params.id);
  try {
    const device = await GPSDevice.findById(req.params.id);

    if (!device) {
      console.warn(' [WARN] Device not found for delete:', req.params.id);
      return res.status(404).json({ error: 'Device not found' });
    }

    await device.deleteOne();

    console.log(' [DEBUG] Device deleted:', {
      id: device._id,
      imei: device.imei,
    });
    await logger.audit(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      "delete",
      "gps_device",
      `Deleted device ${device.imei}`,
      "success",
      req.user?.tenant_id || null,
      req.trace_id
    );
    res.json({
      message: 'Device deleted successfully',
      deleted_id: device._id,
    });
  } catch (err) {
    console.error(' [ERROR] DeleteDevice failed:', err.message);
    await logger.error(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      err,
      "gps_device",
      req.user?.tenant_id || null,
      req.trace_id,
      400
    );
    res.status(500).json({ error: err.message });
  }
};


// ─────────────────────────────────────────────
// POST /gps-devices/:id/heartbeat
// Transaction: device.save() (last_seen + failed_attempts reset — both must commit together)
// Retry: yes — heartbeat is critical for device health tracking
// ─────────────────────────────────────────────
exports.heartbeat = async (req, res) => {
  console.log(' [DEBUG] Heartbeat received from device:', req.params.id, 'payload:', req.body);

  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();

    try {
      attempt++;

      let updatedDevice; // ✅ outside

      await session.withTransaction(async () => {
        const device = await GPSDevice.findById(req.params.id).session(session);

        if (!device) {
          const err = new Error('Device not found');
          err.statusCode = 404;
          throw err;
        }

        device.installed_on = new Date();
        device.failed_attempts = 0;

        await device.save({ session });

        updatedDevice = device; // ✅ store here
      });

      session.endSession();

      await logger.audit(
        "SYSTEM",
        "GPS_DEVICE",
        "device",
        "heartbeat",
        "gps_device",
        `Heartbeat received from ${updatedDevice.imei}`,
        "success",
        null,
        req.trace_id
      );

      return res.json({
        message: 'Heartbeat acknowledged',
        status: updatedDevice.status,
        last_seen: updatedDevice.installed_on,
      });

    } catch (err) {
      session.endSession();

      // 404 — no point retrying
      if (err.statusCode === 404) {
        console.warn(' [WARN] Device not found:', req.params.id);
        return res.status(404).json({ error: 'Device not found' });
      }

      // Retry on transient errors
      if (
        err.errorLabels &&
        (err.errorLabels.includes("TransientTransactionError") ||
          err.errorLabels.includes("UnknownTransactionCommitResult"))
      ) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        if (attempt < MAX_RETRIES) {
          console.warn(` [RETRY] Heartbeat attempt ${attempt} failed, retrying in ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      console.error(' [ERROR] Heartbeat failed:', err.message);
      await logger.error(
        req.user?.employee_id || "SYSTEM",
        req.user?.employee_id?.name || "SYSTEM",
        req.user?.role || "unknown",
        err,
        "gps_device",
        req.user?.tenant_id || null,
        req.trace_id,
        500
      );
      return res.status(500).json({ error: err.message });
    }
  }
};









// // controllers/gpsDeviceController.js
// // Handles CRUD operations for GPS devices with debug logs

// const GPSDevice = require('../models/gpsDevice');
// const logger = require('../utils/logger');


// // POST /gps-devices → Add new GPS device
// exports.addDevice = async (req, res) => {
//   console.log(' [DEBUG] AddDevice request body:', req.body);
//   try {
//     const device = new GPSDevice(req.body);
//     await device.save();
//     console.log(' [DEBUG] Device saved:', device);
//     await logger.audit(
//       req.user?.employee_id || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       "create",
//       "gps_device",
//       `Device ${device.imei} created`,
//       "success",
//       req.user?.tenant_id || null,
//       req.trace_id
//     );
//     res.status(201).json(device);
//   } catch (err) {
//     console.error(' [ERROR] AddDevice failed:', err.message);
//     await logger.error(
//       req.user?.employee_id || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       err,
//       "gps_device",
//       req.user?.tenant_id || null,
//       req.trace_id,
//       400
//     );
//     res.status(400).json({ error: err.message });
//   }
// };

// // GET /gps-devices → View all devices
// exports.getDevices = async (req, res) => {
//   console.log(' [DEBUG] Fetching all devices');
//   try {
//     const devices = await GPSDevice.find();
//     console.log(' [DEBUG] Devices found:', devices.length);
//     await logger.audit(
//       req.user?.employee_id || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       "read",
//       "gps_device",
//       `Fetched all devices`,
//       "success",
//       req.user?.tenant_id || null,
//       req.trace_id
//     );
//     res.json(devices);
//   } catch (err) {
//     console.error(' [ERROR] GetDevices failed:', err.message);
//     await logger.error(
//       req.user?.employee_id || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       err,
//       "gps_device",
//       req.user?.tenant_id || null,
//       req.trace_id,
//       400
//     );
//     res.status(500).json({ error: err.message });
//   }
// };

// // GET /gps-devices/:id → View single device
// exports.getDeviceById = async (req, res) => {
//   console.log(' [DEBUG] Fetching device by ID:', req.params.id);
//   try {
//     const device = await GPSDevice.findById(req.params.id);
//     if (!device) {
//       console.warn(' [WARN] Device not found:', req.params.id);
//       return res.status(404).json({ error: 'Device not found' });
//     }
//     await logger.audit(
//       req.user?.employee_id || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       "read",
//       "gps_device",
//       `Fetched device ${req.params.id}`,
//       "success",
//       req.user?.tenant_id || null,
//       req.trace_id
//     );
//     res.json(device);
//   } catch (err) {
//     console.error(' [ERROR] GetDeviceById failed:', err.message);
//     await logger.error(
//       req.user?.employee_id || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       err,
//       "gps_device",
//       req.user?.tenant_id || null,
//       req.trace_id,
//       400
//     );
//     res.status(500).json({ error: err.message });
//   }
// };


// // PUT /gps-devices/:id → Edit device
// exports.updateDevice = async (req, res) => {
//   console.log(' [DEBUG] Updating device ID:', req.params.id, 'with data:', req.body);
//   try {
//     const device = await GPSDevice.findById(req.params.id);

//     if (!device) {
//       console.warn(' [WARN] Device not found for update:', req.params.id);
//       return res.status(404).json({ error: 'Device not found' });
//     }

//     // Apply updates safely
//     Object.assign(device, req.body);

//     // Trigger self-healing validation
//     await device.save();

//     console.log(' [DEBUG] Device updated:', {
//       id: device._id,
//       imei: device.imei,
//       status: device.status,
//     });
//     await logger.audit(
//       req.user?.employee_id || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       "update",
//       "gps_device",
//       `Updated device ${device.imei}`,
//       "success",
//       req.user?.tenant_id || null,
//       req.trace_id
//     );
//     res.json({
//       message: 'Device updated successfully',
//       device,
//     });
//   } catch (err) {
//     console.error(' [ERROR] UpdateDevice failed:', err.message);
//     await logger.error(
//       req.user?.employee_id || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       err,
//       "gps_device",
//       req.user?.tenant_id || null,
//       req.trace_id,
//       400
//     );
//     res.status(400).json({ error: err.message });
//   }
// };

// // DELETE /gps-devices/:id → Delete device
// exports.deleteDevice = async (req, res) => {
//   console.log(' [DEBUG] Deleting device ID:', req.params.id);
//   try {
//     const device = await GPSDevice.findById(req.params.id);

//     if (!device) {
//       console.warn(' [WARN] Device not found for delete:', req.params.id);
//       return res.status(404).json({ error: 'Device not found' });
//     }

//     await device.deleteOne();

//     console.log(' [DEBUG] Device deleted:', {
//       id: device._id,
//       imei: device.imei,
//     });
//     await logger.audit(
//       req.user?.employee_id || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       "delete",
//       "gps_device",
//       `Deleted device ${device.imei}`,
//       "success",
//       req.user?.tenant_id || null,
//       req.trace_id
//     );
//     res.json({
//       message: 'Device deleted successfully',
//       deleted_id: device._id,
//     });
//   } catch (err) {
//     console.error(' [ERROR] DeleteDevice failed:', err.message);
//     await logger.error(
//       req.user?.employee_id || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       err,
//       "gps_device",
//       req.user?.tenant_id || null,
//       req.trace_id,
//       400
//     );
//     res.status(500).json({ error: err.message });
//   }
// };


// /*

// // Heartbeat endpoint for GPS devices

// Deployment Flow
// Backend API → hosted on your server/cloud (e.g., NIC cloud, AWS, Azure).
// Device firmware → configured with your server’s IP/domain + port.
// Device ping → sends heartbeat packets to your backend.
// Backend updates DB → marks device as alive, resets failed attempts.
// Cron job → checks if last ping > threshold → marks device FAULTY.


// The API is deployed on your backend server.
// The device firmware is configured to call that API at intervals.
// The backend updates the device’s last_seen timestamp, which your health check job uses to decide if the device is alive or faulty.

// */
// // POST /gps-devices/:id/heartbeat
// /*
// Sample Heartbeat Payload (JSON)
// {
//   "imei": "356938035643809",                 // Unique device IMEI
//   "vehicle_registration_number": "UP32AB1234", // Vehicle identity
//   "timestamp": "2026-01-27T18:00:00Z",       // UTC timestamp of heartbeat
//   "coordinates": {
//     "latitude": 28.6139,
//     "longitude": 77.2090
//   },
//   "speed": 45.2,                            // Current speed in km/h
//   "heading": 90.0,                          // Direction in degrees
//   "altitude": 210.0,                        // Altitude in meters
//   "status_flags": {
//     "panic_button": false,                  // Emergency button pressed?
//     "tamper_detected": false,               // Device tamper status
//     "overspeed": false,                     // Overspeed flag
//     "device_health": "OK"                   // Health status
//   },
//   "network": {
//     "signal_strength": -82,                 // GSM RSSI in dBm
//     "operator": "Airtel-IN"                 // Cellular operator
//   }
// }

// POST https://yourserver.com/gps-devices/<DEVICE_ID>/heartbeat


// How It Works
// Device firmware sends this payload via HTTP POST to your backend:

// POST https://yourserver.com/gps-devices/<DEVICE_ID>/heartbeat

// Backend API updates the device’s installed_on or last_seen timestamp.
// Health check cron job uses this timestamp to decide if the device is alive or should be marked FAULTY.
// Operators can see logs like [DEBUG] Heartbeat received from device: ... for audit clarity.
// */

// // POST /gps-devices/:id/heartbeat
// exports.heartbeat = async (req, res) => {
//   console.log(' [DEBUG] Heartbeat received from device:', req.params.id, 'payload:', req.body);
//   try {
//     const device = await GPSDevice.findById(req.params.id);
//     if (!device) {
//       console.warn(' [WARN] Device not found:', req.params.id);
//       return res.status(404).json({ error: 'Device not found' });
//     }

//     // Update last seen timestamp
//     device.installed_on = new Date();

//     // Reset failed attempts on successful heartbeat
//     device.failed_attempts = 0;

//     await device.save();

//     console.log(` [HEARTBEAT OK] Device ${device.serial_number} is alive at ${device.installed_on}`);
//     await logger.audit(
//       "SYSTEM",
//       "GPS_DEVICE",
//       "device",
//       "heartbeat",
//       "gps_device",
//       `Heartbeat received from ${device.imei}`,
//       "success",
//       null,
//       req.trace_id
//     );
//     res.json({
//       message: 'Heartbeat acknowledged',
//       status: device.status,
//       last_seen: device.installed_on
//     });
//   } catch (err) {
//     console.error(' [ERROR] Heartbeat failed:', err.message);
//     await logger.error(
//       req.user?.employee_id || "SYSTEM",
//       req.user?.employee_id?.name || "SYSTEM",
//       req.user?.role || "unknown",
//       err,
//       "gps_device",
//       req.user?.tenant_id || null,
//       req.trace_id,
//       400
//     );
//     res.status(500).json({ error: err.message });
//   }
// };
