// Tenant Auth Controller
// 21/03/2026
// Purpose: Handles tenant user authentication (admin, manager, helpdesk, etc.)
// Uses Employee module for emp_id reference.
// Includes audit logging and structured error handling.

const User = require('../models/userModel');
const Employee = require('../models/employeeModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');
const TokenBlacklist = require('../models/tokenBlacklistModel');

/**
 * Generate JWT tokens for tenant users
 */
function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      id: user._id,
      role: user.role.name,
      employee_id: user.employee_id,   // from Employee record
      privileges: user.role.privileges,
      tenant_id: user.tenant_id
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  const refreshToken = jwt.sign(
    {
      id: user._id,
      role: user.role.name,
      tenant_id: user.tenant_id
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
}

/**
 * Tenant User Login
 */
exports.tenantLogin = async (req, res, next) => {
  const { email, password } = req.body;
  console.log('tenantAuthController: tenantLogin: ', req.body);
  try {
    const user = await User.findOne({ email })
      .populate('role')
      .populate('employee_id');

      console.log('employee id:', user?.employee_id);
      console.log('employee name:', user?.employee_id?.name);
      
    console.log('tenantAuthController: tenantLogin: user found:', user);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const { accessToken, refreshToken } = generateTokens(user);

    await logger.audit(
      user.employee_id,
      user.employee_id.name,   // NEW: pass employee name
      user.role.name,
      "login",
      "user",
      `${user.role.name} ${user.employee_id.name} login successful`,
      "success",
      user.tenant_id,
      req.trace_id
    );
    console.log('tenantAuthController: tenantLogin: login successful, returning tokens');
    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error("tenantLogin error:", err);
    await logger.error(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      err,
      "tenantAuth",
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );
    next(err);
  }
};

/**
 * Tenant User Logout
 */
exports.tenantLogout = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (token) {
      // Verify token before blacklisting (safer than decode)
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      } catch (err) {
        return res.status(403).json({ error: "Invalid or expired token" });
      }

      const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date();

      await TokenBlacklist.create({
        token,
        user_id: req.user?.id || decoded?.id || null,
        reason: "logout",
        expiresAt
      });
    }

    // Audit log with safe fallbacks
    await logger.audit(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      "logout",
      "user",
      `${req.user?.role || "unknown"} ${req.user?.employee_id?.name || ""} logout successful`,
      "success",
      req.user?.tenant_id || null,
      req.trace_id
    );

    return res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("tenantLogout error:", err);

    await logger.error(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      err,
      "tenantAuth",
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    return res.status(500).json({ error: "Logout failed" });
  }
};


/**
 * Tenant User Refresh Token
 */
exports.tenantRefresh = async (req, res, next) => {
  const { token } = req.body;
  console.log('tenantAuthController: tenantRefresh: ', req.body);

  if (!token) return res.status(401).json({ error: "Refresh token required" });

  try {
    const blacklisted = await TokenBlacklist.findOne({ token });
    if (blacklisted) {
      return res.status(403).json({ error: "Refresh token is blacklisted" });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    console.log('tenantAuthController: tenantRefresh: decoded payload:', decoded);

    const user = await User.findById(decoded.id)
      .populate('role')
      .populate('employee_id');

    if (!user) return res.status(403).json({ error: "User not found" });

    const { accessToken, refreshToken } = generateTokens(user);

    await logger.audit(
      user.employee_id,
      user.employee_id.name,
      user.role.name,
      "refresh",
      "user",
      `${user.role.name} ${user.employee_id.name} token refreshed`,
      "success",
      user.tenant_id,
      req.trace_id
    );

    res.json({ accessToken, refreshToken });
  } catch (err) {
    await logger.error(
      null,
      null,
      "tenantAuth",
      err,
      "user",
      null,
      req.trace_id,
      403
    );
    res.status(403).json({ error: "Invalid or expired refresh token" });
  }
};














// // controllers/tenantAdminAuthController.js
// const User = require('../models/userModel');
// const jwt = require('jsonwebtoken');
// const bcrypt = require('bcrypt');
// const logger = require('../utils/logger');

// function generateTokens(user) {
//   const accessToken = jwt.sign(
//     { id: user._id, role: user.role.name, emp_id: user.emp_id, tenant_id: user.tenant_id },
//     process.env.JWT_SECRET,
//     { expiresIn: "15m" }
//   );

//   const refreshToken = jwt.sign(
//     { id: user._id },
//     process.env.JWT_REFRESH_SECRET,
//     { expiresIn: "7d" }
//   );

//   return { accessToken, refreshToken };
// }

// /**
//  * Tenant Admin Login
//  */
// exports.tenantAdminLogin = async (req, res, next) => {
//   const { email, password } = req.body;
//   try {
//     const user = await User.findOne({ email }).populate('role');
//     if (!user || user.role.name !== "tenant_admin") {
//       return res.status(403).json({ error: "Forbidden: Tenant Admin only" });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

//     const { accessToken, refreshToken } = generateTokens(user);
//     await logger.audit(user.emp_id, user.role.name, "login", "user", "Tenant Admin login successful", "success", user.tenant_id, null);
//     res.json({ accessToken, refreshToken });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * Tenant Admin Logout
//  */
// exports.tenantAdminLogout = async (req, res, next) => {
//   try {
//     await logger.audit(req.user.emp_id, req.user.role, "logout", "user", "Tenant Admin logout successful", "success", req.user.tenant_id, null);
//     res.json({ message: "Logged out successfully" });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * Tenant Admin Refresh Token
//  */
// exports.tenantAdminRefresh = async (req, res, next) => {
//   const { token } = req.body;
//   if (!token) return res.status(401).json({ error: "Refresh token required" });

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
//     const user = await User.findById(decoded.id).populate('role');
//     if (!user || user.role.name !== "tenant_admin") {
//       return res.status(403).json({ error: "Forbidden: Tenant Admin only" });
//     }

//     const { accessToken, refreshToken } = generateTokens(user);
//     res.json({ accessToken, refreshToken });
//   } catch (err) {
//     res.status(403).json({ error: "Invalid or expired refresh token" });
//   }
// };

