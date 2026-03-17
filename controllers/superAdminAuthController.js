// controllers/superAdminAuthController.js
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

function generateTokens(user) {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT secrets are not defined in environment variables");
  }
  
  const accessToken = jwt.sign(
    { id: user._id, role: user.role.name, emp_id: user.emp_id },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
}

/**
 * Super Admin Login
 */
exports.superAdminLogin = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).populate('role');
    if (!user || user.role.name !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Super Admin only" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const { accessToken, refreshToken } = generateTokens(user);
    await logger.audit(user.emp_id, user.role.name, "login", "user", "Super Admin login successful", "success", null, null);
    res.json({ accessToken, refreshToken, user: { id: user._id, role: user.role.name } });
  } catch (err) {
    next(err);
  }
};

/**
 * Super Admin Logout
 */
exports.superAdminLogout = async (req, res, next) => {
  try {
    await logger.audit(req.user.emp_id, req.user.role, "logout", "user", "Super Admin logout successful", "success", null, null);
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * Super Admin Refresh Token
 */
exports.superAdminRefresh = async (req, res, next) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: "Refresh token required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).populate('role');
    if (!user || user.role.name !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Super Admin only" });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    res.json({ accessToken, refreshToken });
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired refresh token" });
  }
};

