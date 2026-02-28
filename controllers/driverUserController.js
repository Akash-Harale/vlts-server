// /controllers/driverUserController.js
const User = require('../models/user');

exports.getAllDriversWithUserId = async (req, res) => {
  try {
    // Find all users and populate driver details
    const users = await User.find().populate('driver_id');

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'No drivers found' });
    }

    // Map into clean response objects
    const result = users.map(user => ({
      user_id: user.user_id,
      driver_id: user.driver_id?._id,
      driver_name: user.driver_id?.driver_name,
      mobile_number: user.driver_id?.mobile_number,
      email_id: user.driver_id?.email_id,
      created_at: user.driver_id?.created_at
    }));

    res.json(result);
  } catch (err) {
    console.error('Error in getAllDriversWithUserId:', err);
    res.status(500).json({ error: err.message });
  }
};

