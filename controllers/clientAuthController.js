// clientAuthController.js
// 21 March 2026
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Client = require('../models/client.model');
const ClientProfile = require('../models/clientProfileModel');
const Employee = require('../models/employeeModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');
const { blacklistToken, verifyRefreshToken } = require('../utils/tokenService');

function generateTokens(user) {
  const accessToken = jwt.sign( 
    {
      id: user._id,
      role: user.role.name,
      employee_id: user.employee_id,
      tenant_id: user.tenant_id,
      client_profile_id: user.client_profile_id,
      privileges: user.role.privileges
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
}

exports.clientLogin = async (req, res, next) => {
  const { email, password } = req.body;
  console.log('clientLogin: req.body', req.body);
  try {
    const user = await User.findOne({ email })
      .populate('role')
      .populate("employee_id", "_id name");

    if (!user || !user.role.name.startsWith("client_")) {
      return res.status(403).json({ error: "Forbidden: Client only" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const { accessToken, refreshToken } = generateTokens(user);

    await logger.audit(
      user.employee_id?._id?.toString() || "SYSTEM",
      user.employee_id?.name || "Client User",
      user.role.name,
      "login",
      "user",
      `${user.role.name} login successful`,
      "success",
      user.tenant_id,
      req.trace_id
    );
    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error('clientLogin error: ', err);
    await logger.error(null, "clientLogin", err, "user", null, null, 500);
    await logger.error(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      err,
      "ClientAuth",
      req.user?.client_id || null,
      req.trace_id,
      500
    );
    next(err);
  }
};



exports.getClientProfile = async (req, res) => {
  try {
    // req.user is populated by authMiddleware (JWT payload)
    const { id, role, employee_id, tenant_id, client_profile_id, privileges } = req.user;

    // Email isn't embedded in the JWT — fetch it from the DB
    const userDoc = await User.findById(id, 'email');
    const email = userDoc?.email || null;

    return res.json({
      user: { id, role, email, employee_id, tenant_id, client_profile_id, privileges }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Could not retrieve profile' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/client-auth/me
// Returns the logged-in client's full organisation profile (Client document)
// plus their own Employee record. No params needed — uses JWT claims only.
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyProfile = async (req, res) => {
  console.log('getMyProfile: req.user', req.user);
  try {
    const { id, client_profile_id, employee_id, tenant_id, role, privileges } = req.user;
    console.log("======================================================")
    console.log('getMyProfile: id', id);
    console.log('getMyProfile: client_profile_id', client_profile_id);
    console.log('getMyProfile: employee_id', employee_id);
    console.log('getMyProfile: tenant_id', tenant_id);
    console.log('getMyProfile: role', role);
    console.log('getMyProfile: privileges', privileges);

    if (!client_profile_id) {
      return res.status(403).json({ error: 'No client profile linked to this account' });
    }

    const clientProfile = await ClientProfile.findById(client_profile_id);
    console.log('getMyProfile: clientProfile', clientProfile);
    if (!clientProfile) {
      return res.status(404).json({ error: 'Client profile not found' });
    }

    const employeeRecord = employee_id
      ? await Employee.findById(employee_id)
          .lean()
          .select('name email mobile_number designation scope tenant_id client_profile_id')
      : null;

    await logger.audit(
      employee_id?.toString() || 'SYSTEM',
      employeeRecord?.name || 'Client User',
      role,
      'read',
      'client',
      `Client fetched own profile: ${clientProfile.entity_name}`,
      'success',
      tenant_id,
      req.trace_id
    );

    return res.json({
      user: {
        id,
        role,
        tenant_id,
        client_profile_id,
        privileges
      },
      organisation: clientProfile,
      employee: employeeRecord
    });
  } catch (err) {
    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'client',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );
    return res.status(500).json({ error: 'Could not retrieve profile' });
  }
};

exports.clientLogout = async (req, res, next) => {
  try {
    const { token } = req.body;
    await blacklistToken(token, req.user.id, "logout");

    await logger.audit(
      req.user.employee_id?.toString() || req.user.id,
      "Client User",  // Since name not available in JWT
      req.user.role,
      "logout",
      "user",
      "Client logout successful",
      "success",
      req.user.tenant_id,
      req.trace_id
    );

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    await logger.error(req.user.emp_id, req.user.emp_name, req.user.role, err, "user", req.user.tenant_id, req.trace_id);
    next(err);
  }
};

exports.clientRefresh = async (req, res, next) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: "Refresh token required" });

  try {
    const decoded = await verifyRefreshToken(token);
    if (!decoded) return res.status(403).json({
      error: "Invalid or blacklisted refresh token"
    });

    const user = await User.findById(decoded.id).populate('role');
    if (!user || !user.role.name.startsWith("client_")) {
      await logger.audit(user?.employee_id?._id?.toString() || "SYSTEM", user?.role?.name, "refresh", "user", "Forbidden: Client only", "failed", user?.tenant_id, null);
      return res.status(403).json({ error: "Forbidden: Client only" });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    await logger.audit(
      user.employee_id._id.toString(),
      user.employee_id.name,   // NEW: pass employee name
      user.role.name,
      "refresh",
      "user",
      "Client token refreshed",
      "success",
      user.tenant_id,
      null
    );

    res.json({ accessToken, refreshToken });
  } catch (err) {
    await logger.error(null, null, "client", err, "user", null, null, 403);
    res.status(403).json({ error: "Invalid or expired refresh token" });
  }
};











// // /controllers/authController.js
// // Use for driver login/logout (no JWT for now, just return user details)

// const User = require('../models/user');

// exports.login = async (req, res) => {
//   try {
//     const { user_id, password } = req.body;

//     const user = await User.findOne({ user_id }).populate('driver_id');
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     const isMatch = await user.comparePassword(password);
//     if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

//     // For simplicity, return user + driver details (JWT can be added later)
//     /*res.json({
//       user_id: user.user_id,
//       driver_id: user.driver_id._id,
//       driver_name: user.driver_id.driver_name
//     });*/

//     const response = {
//       user_id: user.user_id,
//       driver_id: user.driver_id._id,
//       driver_name: user.driver_id.driver_name
//     };

//     return res.json({ success: true, message: response });

//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // /controllers/authController.js
// exports.logout = async (req, res) => {
//   try {
//     // In stateless mode, nothing to invalidate on server
//     res.json({ message: 'User logged out successfully' });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };
