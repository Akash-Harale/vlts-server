// controllers/tenantUserController.js
// Purpose: Manage tenant users (CRUD) — Tenant Admin only

const User = require('../models/userModel');
const Role = require('../models/roleModel');
const logger = require('../utils/logger');

/**
 * Create a new tenant user
 * Body: { emp_id, email, password, roleName }
 */
exports.createTenantUser = async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || null;
  try {
    const { emp_id, email, password, roleName } = req.body;

    // Ensure role exists
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    // Create user scoped to tenant
    const user = await User.create({
      emp_id,
      email,
      password, // pre-save hook will hash
      role: role._id,
      tenant_id: req.user.tenant_id
    });

    await logger.audit(
      req.user.emp_id,
      req.user.role,
      "create",
      "user",
      `Tenant user ${email} created with role ${roleName}`,
      "success",
      req.user.tenant_id,
      requestId
    );

    res.status(201).json(user);
  } catch (err) {
    await logger.error(
      req.user.emp_id,
      req.user.role,
      err,
      "tenantUserCreate",
      req.user.tenant_id,
      requestId,
      500
    );
    next(err);
  }
};

/**
 * Get all users in tenant
 */
exports.getTenantUsers = async (req, res, next) => {
  try {
    const users = await User.find({ tenant_id: req.user.tenant_id }).populate('role');
    res.json(users);
  } catch (err) {
    next(err);
  }
};

/**
 * Update tenant user
 * PUT /api/auth/tenantadmin/users/:id
 */
exports.updateTenantUser = async (req, res, next) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, tenant_id: req.user.tenant_id },
      req.body,
      { new: true }
    ).populate('role');

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete tenant user
 * DELETE /api/auth/tenantadmin/users/:id
 */
exports.deleteTenantUser = async (req, res, next) => {
  try {
    const user = await User.findOneAndDelete({
      _id: req.params.id,
      tenant_id: req.user.tenant_id
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "Tenant user deleted successfully" });
  } catch (err) {
    next(err);
  }
};
