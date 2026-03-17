// controllers/tenantAdminAuthController.js
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role.name, emp_id: user.emp_id, tenant_id: user.tenant_id },
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
 * Tenant Admin Login
 */
exports.tenantAdminLogin = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).populate('role');
    if (!user || user.role.name !== "tenant_admin") {
      return res.status(403).json({ error: "Forbidden: Tenant Admin only" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const { accessToken, refreshToken } = generateTokens(user);
    await logger.audit(user.emp_id, user.role.name, "login", "user", "Tenant Admin login successful", "success", user.tenant_id, null);
    res.json({ accessToken, refreshToken, user: { id: user._id, role: user.role.name, tenant_id: user.tenant_id } });
  } catch (err) {
    next(err);
  }
};

/**
 * Tenant Admin Logout
 */
exports.tenantAdminLogout = async (req, res, next) => {
  try {
    await logger.audit(req.user.emp_id, req.user.role, "logout", "user", "Tenant Admin logout successful", "success", req.user.tenant_id, null);
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * Tenant Admin Refresh Token
 */
exports.tenantAdminRefresh = async (req, res, next) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: "Refresh token required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).populate('role');
    if (!user || user.role.name !== "tenant_admin") {
      return res.status(403).json({ error: "Forbidden: Tenant Admin only" });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    res.json({ accessToken, refreshToken });
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired refresh token" });
  }
};
 
 /**
  * Tenant Admin Profile
  */
 exports.getProfile = async (req, res, next) => {
   try {
     res.json({ user: { id: req.user.id, role: req.user.role, emp_id: req.user.emp_id, tenant_id: req.user.tenant_id } });
   } catch (err) {
     next(err);
   }
 };

