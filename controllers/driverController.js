// /controllers/driverController.js
const Driver = require('../models/driver');
const User = require('../models/user');
const Employee = require('../models/employeeModel');
const Role = require('../models/roleModel');
const DriverVehicleAssignment = require("../models/driverVehicleAssignment");
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateTokens } = require('./clientAuthController');


const getMeta = (req) => ({
  emp_id: req.user?.employee_id?._id?.toString() || "SYSTEM",
  emp_name: req.user?.employee_id?.name || "SYSTEM",
  role: req.user?.role || "unknown",
  tenant_id: req.user?.tenant_id || null,
  trace_id: req.headers['x-request-id'] || req.trace_id || null
});

const MAX_RETRIES = parseInt(process.env.TRANSACTION_MAX_RETRIES || "3", 10);
const BASE_DELAY_MS = parseInt(process.env.TRANSACTION_BACKOFF_MS || "100", 10);

// CREATE Driver + Employee + User
exports.createDriver = async (req, res) => {
  const meta = getMeta(req);
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();
    let savedDriver, savedEmployee, savedUser;

    try {
      attempt++;

      await session.withTransaction(async () => {
        const { driver_name, driver_license,
          mobile_number, email_id, user_id, password } = req.body;

        if (!email_id || !password) {
          const err = new Error("email and password are required");
          err.statusCode = 400;
          throw err;
        }

        // Create Employee
        const employee = new Employee({
          name: driver_name,
          email: email_id,
          mobile_number: mobile_number,
          designation: "Driver",
          scope: "client",
          tenant_id: meta.tenant_id,
          client_profile_id: req.user?.client_profile_id
        });
        await employee.save({ session });

        // Create Driver
        const driver = new Driver({
          driver_name,
          driver_license,
          mobile_number,
          email_id,
          user_id: email_id // Use email as user_id for backward compatibility
        });
        await driver.save({ session });

        // Find driver role
        // const driverRole = await Role.findOne({ 
        //   name: "driver" }).session(session);
        // if (!driverRole) {
        //   const err = new Error("Driver role not found");
        //   err.statusCode = 500;
        //   throw err;
        // }

        // Create User
        const user = new User({
          employee_id: employee._id,
          email: email_id,
          password,
          //role: driverRole._id,
          scope: "client",
          tenant_id: meta.tenant_id,
          client_profile_id: req.user?.client_profile_id
        });
        await user.save({ session });

        savedDriver = driver;
        savedEmployee = employee;
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
        message: 'Driver, Employee and User created successfully',
        driver: savedDriver,
        employee: savedEmployee,
        user: { email: savedUser.email, employee_id: savedEmployee._id }
      });

    } catch (err) {
      session.endSession();
      console.error("createDriver error:", err);
      if (err.statusCode === 400 || err.statusCode === 500) {
        await logger.audit(meta.emp_id, meta.emp_name, meta.role, "create", "driver", err.message, "failed", meta.tenant_id, meta.trace_id);
        return res.status(err.statusCode).json({ error: err.message });
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
    // ── Client scoping: clients may only see drivers belonging to their account ──
    const isClientRole = req.user?.role?.startsWith("client_");
    const clientProfileId = req.user?.client_profile_id;

    let drivers;
    if (isClientRole) {
      if (!clientProfileId) {
        return res.status(403).json({ success: false, message: "Client profile not linked to user" });
      }
      // Find all employees that belong to this client, then fetch matching drivers by email
      const clientEmployees = await Employee.find(
        { client_profile_id: clientProfileId },
        "email"
      );
      const clientEmails = clientEmployees.map((e) => e.email);
      drivers = await Driver.find({ email_id: { $in: clientEmails } });
    } else {
      drivers = await Driver.find();
    }

    await logger.audit(
      meta.emp_id,
      meta.emp_name,
      meta.role,
      "read",
      "driver",
      `Fetched ${drivers.length} drivers${isClientRole ? ` for client ${clientProfileId}` : ""}`,
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
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    await logger.audit(meta.emp_id, meta.emp_name, meta.role, "read", "driver", "Driver not found", "failed", meta.tenant_id, meta.trace_id);
    console.log('Driver not found');
    return res.status(404).json({ error: 'Driver not found' });
  }
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      await logger.audit(meta.emp_id, meta.emp_name, meta.role, "read", "driver", "Driver not found", "failed", meta.tenant_id, meta.trace_id);
      return res.status(404).json({ error: 'Driver not found' });
    }

    // ── Client scoping: enforce ownership via Employee link ──
    const isClientRole = req.user?.role?.startsWith("client_");
    const clientProfileId = req.user?.client_profile_id;

    if (isClientRole) {
      if (!clientProfileId) {
        return res.status(403).json({ success: false, message: "Client profile not linked to user" });
      }
      const employee = await Employee.findOne({
        email: driver.email_id,
        client_profile_id: clientProfileId
      });
      if (!employee) {
        return res.status(403).json({ error: "Access denied: driver does not belong to your account" });
      }
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

// DELETE Driver + Employee + User
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

        // Find User by email
        const user = await User.findOne({ email: driver.email_id }).session(session);
        if (user) {
          // Delete User
          await User.findByIdAndDelete(user._id).session(session);

          // Delete Employee
          await Employee.findByIdAndDelete(user.employee_id).session(session);
        }

        // Delete Driver
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

      return res.json({ message: 'Driver, Employee and User deleted successfully' });

    } catch (err) {
      console.error("deleteDriver error:", err);
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


// for driver interface- mobile app
exports.loginDriver = async (req, res) => {
  const meta = getMeta(req);

  console.log('req.body: ', req.body);
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();
    try {
      attempt++;

      await session.withTransaction(async () => {
        const { driver_id, password } = req.body;

        if (!driver_id || !password) {
          const err = new Error("Driver ID and password are required");
          err.statusCode = 400;
          throw err;
        }

        // Find Driver
        const driver = await User.findOne({ email: driver_id, role: "69f88fe73e138c94685cd2e5" }).session(session);
        if (!driver) {
          const err = new Error("Driver not found");
          err.statusCode = 404;
          throw err;
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, driver.password);
        if (!isPasswordValid) {
          const err = new Error("Invalid password");
          err.statusCode = 401;
          throw err;
        }

        // get employee record
        const employee = await Employee.findById(driver.employee_id);
        if (!employee) {
          const err = new Error("Employee not found");
          err.statusCode = 404;
          throw err;
        }

        const { accessToken, refreshToken } = generateTokens(driver);


        return res.status(200).json({
          message: "Driver logged in successfully",
          accessToken,
          refreshToken,
          driver
        });
      });

      session.endSession();

    } catch (err) {
      console.error("loginDriver error:", err);
      session.endSession();

      if (err.statusCode === 400 || err.statusCode === 401 || err.statusCode === 404) {
        return res.status(err.statusCode).json({ error: err.message });
      }

      if (err.errorLabels?.includes("TransientTransactionError") && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, BASE_DELAY_MS * attempt));
        continue;
      }

      return res.status(500).json({ error: err.message });
    }
  }
};
