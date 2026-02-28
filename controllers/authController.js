// /controllers/authController.js
const User = require('../models/user');

exports.login = async (req, res) => {
  try {
    const { user_id, password } = req.body;

    const user = await User.findOne({ user_id }).populate('driver_id');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    // For simplicity, return user + driver details (JWT can be added later)
    /*res.json({
      user_id: user.user_id,
      driver_id: user.driver_id._id,
      driver_name: user.driver_id.driver_name
    });*/

    const response = {
      user_id: user.user_id,
      driver_id: user.driver_id._id,
      driver_name: user.driver_id.driver_name
    };

    return res.json({ success: true, message: response });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// /controllers/authController.js
exports.logout = async (req, res) => {
  try {
    // In stateless mode, nothing to invalidate on server
    res.json({ message: 'User logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
