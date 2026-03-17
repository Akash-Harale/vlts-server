// controllers/tenantUserAuthController.js
// Purpose: Handle Tenant User login, logout, refresh

const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

// Helper: generate access + refresh tokens
function generateTokens(user) {
  const accessToken = jwt.sign(
    { 
      id: user._id, 
      role: user.role.name, 
      emp_id: user.emp_id, 
      tenant_id: user.tenant_id,
      client_id: user.client_id || null 
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" } // short-lived
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" } // long-lived
  );

  return { accessToken, refreshToken };
}

/**
 * Tenant User Login
 */
exports.tenantUserLogin = async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || null;
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).populate('role');
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    // Tenant-scoped roles only
    if (!user.tenant_id) {
      return res.status(403).json({ error: "Forbidden: Tenant User only" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const { accessToken, refreshToken } = generateTokens(user);

    await logger.audit(user.emp_id, user.role.name, "login", "user", "Tenant User login successful", "success", user.tenant_id, requestId);
    res.json({ accessToken, refreshToken, user: { id: user._id, role: user.role.name, tenant_id: user.tenant_id } });
  } catch (err) {
    await logger.error("SYSTEM", "tenant_user_auth", err, "login", null, requestId, 500);
    next(err);
  }
};

/**
 * Tenant User Logout
 */
exports.tenantUserLogout = async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || null;
  try {
    await logger.audit(req.user.emp_id, req.user.role, "logout", "user", "Tenant User logout successful", "success", req.user.tenant_id, requestId);
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * Tenant User Refresh Token
 */
exports.tenantUserRefresh = async (req, res, next) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: "Refresh token required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).populate('role');
    if (!user || !user.tenant_id) {
      return res.status(403).json({ error: "Forbidden: Tenant User only" });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    res.json({ accessToken, refreshToken });
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired refresh token" });
  }
};

