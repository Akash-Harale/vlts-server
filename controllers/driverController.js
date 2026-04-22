// /controllers/driverController.js
const Driver = require('../models/driver');
const User = require('../models/user');
const DriverVehicleAssignment = require("../models/driverVehicleAssignment");
const mongoose = require('mongoose');
const logger = require('../utils/logger');


const getMeta = (req) => ({
  emp_id: req.user?.employee_id?._id?.toString() || "SYSTEM",
  emp_name: req.user?.employee_id?.name || "SYSTEM",
  role: req.user?.role || "unknown",
  tenant_id: req.user?.tenant_id || null,
  trace_id: req.headers['x-request-id'] || req.trace_id || null
});


// CREATE Driver + User
exports.createDriver = async (req, res) => {
  const meta = getMeta(req);
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();
    let savedDriver, savedUser;

    try {
      attempt++;

      await session.withTransaction(async () => {
        const { driver_name, driver_license, mobile_number, email_id, user_id, password } = req.body;

        if (!user_id || !password) {
          const err = new Error("user_id and password are required");
          err.statusCode = 400;
          throw err;
        }

        const driver = new Driver({ driver_name, driver_license, mobile_number, email_id, user_id });
        await driver.save({ session });

        const user = new User({ user_id, password, driver_id: driver._id });
        await user.save({ session });

        savedDriver = driver;
        savedUser = user;
      });

      session.endSession();

      await logger.audit(
        meta.emp_id,
        meta.emp_name,
        meta.role,
        "create",
        "driver",
        `Driver ${savedDriver.driver_name} created`,
        "success",
        meta.tenant_id,
        meta.trace_id
      );

      return res.status(201).json({
        message: 'Driver and User created successfully',
        driver: savedDriver,
        user: { user_id: savedUser.user_id, driver_id: savedDriver._id }
      });

    } catch (err) {
      session.endSession();

      if (err.statusCode === 400) {
        await logger.audit(meta.emp_id, meta.emp_name, meta.role, "create", "driver", err.message, "failed", meta.tenant_id, meta.trace_id);
        return res.status(400).json({ error: err.message });
      }

      if (err.errorLabels?.includes("TransientTransactionError") && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, BASE_DELAY_MS * attempt));
        continue;
      }

      await logger.error(meta.emp_id, meta.emp_name, meta.role, err, "driver", meta.tenant_id, meta.trace_id, 500);

      return res.status(500).json({ error: err.message });
    }
  }
};

// READ All Drivers
exports.getAllDrivers = async (req, res) => {
  const meta = getMeta(req);
console.log('getAllDrivers: called with meta: ', meta);
  try {
    const drivers = await Driver.find();

    await logger.audit(
      meta.emp_id,
      meta.emp_name,
      meta.role,
      "read",
      "driver",
      `Fetched ${drivers.length} drivers`,
      "success",
      meta.tenant_id,
      meta.trace_id
    );

    res.json(drivers);

  } catch (err) {
    console.error("getAllDrivers error:", err);
    await logger.error(
      meta.emp_id,
      meta.emp_name,
      meta.role,
      err,
      "driver",
      meta.tenant_id,
      meta.trace_id,
      500);
    res.status(500).json({ error: err.message });
  }
};

// READ Single Driver by ID
exports.getDriverById = async (req, res) => {
  const meta = getMeta(req);
  console.log('getDriverById: req.params.id: ', req.params.id);
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      await logger.audit(meta.emp_id, meta.emp_name, meta.role, "read", "driver", "Driver not found", "failed", meta.tenant_id, meta.trace_id);
      return res.status(404).json({ error: 'Driver not found' });
    }

    await logger.audit(meta.emp_id, meta.emp_name, meta.role, "read", "driver", `Fetched driver ${driver.driver_name}`, "success", meta.tenant_id, meta.trace_id);

    res.json(driver);

  } catch (err) {
    console.error("getDriverById error:", err);
    await logger.error(meta.emp_id, meta.emp_name, meta.role, err, "driver", meta.tenant_id, meta.trace_id, 500);
    res.status(500).json({ error: err.message });
  }
};

// UPDATE Driver
exports.updateDriver = async (req, res) => {
  const meta = getMeta(req);
console.log('updateDriver: req.params.id: ', req.params.id);
  try {
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!driver) {
      await logger.audit(meta.emp_id, meta.emp_name, meta.role, "update", "driver", "Driver not found", "failed", meta.tenant_id, meta.trace_id);
      return res.status(404).json({ error: 'Driver not found' });
    }

    await logger.audit(meta.emp_id, meta.emp_name, meta.role, "update", "driver", `Driver ${driver.driver_name} updated`, "success", meta.tenant_id, meta.trace_id);

    res.json(driver);

  } catch (err) {
    console.error("updateDriver error:", err);
    await logger.error(meta.emp_id, meta.emp_name, meta.role, err, "driver", meta.tenant_id, meta.trace_id, 400);
    res.status(400).json({ error: err.message });
  }
};

// DELETE Driver + User
exports.deleteDriver = async (req, res) => {
  const meta = getMeta(req);
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();
    let deletedDriver;
console.log('deleteDriver: req.params.id: ', req.params.id);
    try {
      attempt++;

      await session.withTransaction(async () => {
        const driver = await Driver.findById(req.params.id).session(session);

        if (!driver) {
          const err = new Error("Driver not found");
          err.statusCode = 404;
          throw err;
        }

        await User.deleteOne({ driver_id: driver._id }).session(session);
        await Driver.findByIdAndDelete(req.params.id).session(session);

        deletedDriver = driver;
      });

      session.endSession();

      await logger.audit(
        meta.emp_id,
        meta.emp_name,
        meta.role,
        "delete",
        "driver",
        `Driver ${deletedDriver.driver_name} deleted`,
        "success",
        meta.tenant_id,
        meta.trace_id
      );

      return res.json({ message: 'Driver and User deleted successfully' });

    } catch (err) {
      cosole.error("deleteDriver error:", err);
      session.endSession();

      if (err.statusCode === 404) {
        await logger.audit(meta.emp_id, meta.emp_name, meta.role, "delete", "driver", "Driver not found", "failed", meta.tenant_id, meta.trace_id);
        return res.status(404).json({ error: err.message });
      }

      if (err.errorLabels?.includes("TransientTransactionError") && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, BASE_DELAY_MS * attempt));
        continue;
      }

      await logger.error(
        meta.emp_id, meta.emp_name, meta.role, err, "driver", meta.tenant_id, meta.trace_id, 500);

      return res.status(500).json({ error: err.message });
    }
  }
};


