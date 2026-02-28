// /controllers/driverController.js
const Driver = require('../models/driver');
const User = require('../models/user');
const DriverVehicleAssignment = require("../models/driverVehicleAssignment");

// CREATE Driver + User
exports.createDriver = async (req, res) => {
  try {
    console.log('driverController: createDriver API: ', req.body);
    
    const { driver_name, driver_license, mobile_number, email_id, user_id, password } = req.body;

    if (!user_id || !password) {
      return res.status(400).json({ error: 'user_id and password are required' });
    }

    // Step 1: Create Driver
    const driver = new Driver({ driver_name, driver_license, mobile_number, email_id, user_id });
    await driver.save();

    // Step 2: Create User mapped to Driver
    const user = new User({ user_id, password, driver_id: driver._id });
    await user.save();

    res.status(201).json({
      message: 'Driver and User created successfully',
      driver,
      user: { user_id: user.user_id, driver_id: driver._id }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// READ All Drivers
exports.getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ Single Driver by ID
exports.getDriverById = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE Driver
exports.updateDriver = async (req, res) => {
  try {
    const { driver_name, mobile_number, email_id } = req.body;
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { driver_name, mobile_number, email_id },
      { new: true, runValidators: true }
    );
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    res.json(driver);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE Driver + User
exports.deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    // Delete associated user
    await User.deleteOne({ driver_id: driver._id });

    res.json({ message: 'Driver and associated User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


