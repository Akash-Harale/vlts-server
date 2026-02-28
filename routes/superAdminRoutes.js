// routes/superAdminRoutes.js
// Purpose: Super Admin authentication + tenant provisioning/listing

const express = require('express');
const router = express.Router();
const {
  superAdminLogin,
  superAdminLogout,
  superAdminRefresh
} = require('../controllers/superAdminAuthController');

const authMiddleware = require('../middleware/authMiddleware');

// Authentication
/**
 * POST /api/auth/superadmin/login
 * Super Admin login
 */
router.post('/login', superAdminLogin);

/**
 * POST /api/auth/superadmin/logout
 * Super Admin logout
 */
router.post('/logout', authMiddleware(["provision_tenant"]), superAdminLogout);

/**
 * POST /api/auth/superadmin/refresh
 * Refresh token for Super Admin
 */
router.post('/refresh', superAdminRefresh);

module.exports = router;

