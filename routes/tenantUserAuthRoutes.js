// routes/tenantUserAuthRoutes.js
// Purpose: Tenant User authentication (login, logout, refresh)

const express = require('express');
const router = express.Router();
const {
  tenantUserLogin,
  tenantUserLogout,
  tenantUserRefresh
} = require('../controllers/tenantUserAuthController');

const authMiddleware = require('../middleware/authMiddleware');

// Authentication
/**
 * POST /api/auth/tenantuser/login
 * Tenant User login
 */
router.post('/login', tenantUserLogin);

/**
 * POST /api/auth/tenantuser/logout
 * Tenant User logout
 */
router.post('/logout', authMiddleware(["read"]), tenantUserLogout);

/**
 * POST /api/auth/tenantuser/refresh
 * Refresh token for Tenant User
 */
router.post('/refresh', tenantUserRefresh);

module.exports = router;

