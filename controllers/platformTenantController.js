// controllers/platformTenantController.js
// Purpose: Handle tenant provisioning and lifecycle management (Super Admin only)

const Tenant = require('../models/tenantModel');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const logger = require('../utils/logger');

/**
 * Create a new tenant and auto-provision Tenant Admin
 * Body: { tenant_id, name, domain, admin_email, admin_password }
 */
exports.createTenant = async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || null;

  try {
    const { tenant_id, name, domain, admin_email, admin_password } = req.body;

    // Before Tenant.create()

    const existingTenant = await Tenant.findOne({ tenant_id });

    if (existingTenant) {
      return res.status(400).json({
        message: "Tenant ID already exists"
      });
    }


    // Step 1: Create tenant
    const tenant = await Tenant.create({
      tenant_id,
      name,
      domain,
      auth_methods: ["local"],
      status: "active"
    });
    await logger.audit(
      req.user.emp_id,
      req.user.role,
      "create",
      "tenant",
      `Tenant ${name} created`,
      "success",
      tenant._id.toString(),
      requestId
    );

    // Step 2: Find Tenant Admin role
    const tenantAdminRole = await Role.findOne({ name: "tenant_admin" });
    if (!tenantAdminRole) {
      throw new Error("Tenant Admin role not found. Please seed roles first.");
    }

    // Step 3: Create Tenant Admin user
    const tenantAdmin = await User.create({
      emp_id: `${tenant_id}_admin`,
      email: admin_email,
      password: admin_password,
      role: tenantAdminRole._id,
      tenant_id: tenant._id
    });
    await logger.audit(
      req.user.emp_id,
      req.user.role,
      "create",
      "user",
      `Tenant Admin ${admin_email} created`,
      "success",
      tenant._id.toString(),
      requestId
    );

    res.status(201).json({ tenant, tenantAdmin });
  } catch (err) {
    await logger.error(
      req.user.emp_id,
      req.user.role,
      err,
      "tenantProvisioning",
      null,
      requestId,
      500
    );
    next(err);
  }
};

/**
 * List all tenants (Super Admin only)
 */
exports.getTenants = async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || null;

  try {
    const tenants = await Tenant.find();
    await logger.audit(
      req.user.emp_id,
      req.user.role,
      "read",
      "tenant",
      "Fetched tenant list",
      "success",
      null,
      requestId
    );
    res.json(tenants);
  } catch (err) {
    await logger.error(
      req.user.emp_id,
      req.user.role,
      err,
      "tenantListing",
      null,
      requestId,
      500
    );
    next(err);
  }
};

/**
 * Update a tenant (Super Admin only)
 * PUT /api/platform/tenants/:id
 */
exports.updateTenant = async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || null;

  try {
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    await logger.audit(
      req.user.emp_id,
      req.user.role,
      "update",
      "tenant",
      `Tenant ${tenant.name} updated`,
      "success",
      tenant._id.toString(),
      requestId
    );

    res.json(tenant);
  } catch (err) {
    await logger.error(
      req.user.emp_id,
      req.user.role,
      err,
      "tenantUpdate",
      null,
      requestId,
      500
    );
    next(err);
  }
};

/**
 * Delete a tenant (Super Admin only)
 * DELETE /api/platform/tenants/:id
 */
exports.deleteTenant = async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || null;

  try {
    const tenant = await Tenant.findByIdAndDelete(req.params.id);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    await logger.audit(
      req.user.emp_id,
      req.user.role,
      "delete",
      "tenant",
      `Tenant ${tenant.name} deleted`,
      "success",
      req.params.id,
      requestId
    );

    res.json({ message: "Tenant deleted successfully" });
  } catch (err) {
    await logger.error(
      req.user.emp_id,
      req.user.role,
      err,
      "tenantDelete",
      null,
      requestId,
      500
    );
    next(err);
  }
};

