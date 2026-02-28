// routes/platformTenantRoutes.js
// Purpose: Tenant provisioning and lifecycle management (Super Admin only)

const express = require('express');
const router = express.Router();
const {
  createTenant,
  getTenants,
  updateTenant,
  deleteTenant
} = require('../controllers/platformTenantController');

const authMiddleware = require('../middleware/authMiddleware');
const superAdminOnly = require('../middleware/superAdminOnly');

// Create tenant
router.post(
  '/',
  authMiddleware(["provision_tenant"]),
  superAdminOnly,
  createTenant
);

// List tenants
router.get(
  '/',
  authMiddleware(["audit_logs"]),
  superAdminOnly,
  getTenants
);

// Update tenant
router.put(
  '/:id',
  authMiddleware(["update"]),
  superAdminOnly,
  updateTenant
);

// Delete tenant
router.delete(
  '/:id',
  authMiddleware(["delete"]),
  superAdminOnly,
  deleteTenant
);

module.exports = router;

