// routes/tenantAdminRoutes.js
// Purpose: Tenant Admin APIs (auth + manage resources inside tenant)

const express = require('express');
const router = express.Router();
const {
  tenantAdminLogin,
  tenantAdminLogout,
  tenantAdminRefresh
} = require('../controllers/tenantAdminAuthController');

const {
  createTenantUser,
  getTenantUsers,
  updateTenantUser,
  deleteTenantUser
} = require('../controllers/tenantUserController');

const authMiddleware = require('../middleware/authMiddleware');

// Authentication
router.post('/login', tenantAdminLogin);
router.post('/logout', authMiddleware(["manage_users"]), tenantAdminLogout);
router.post('/refresh', tenantAdminRefresh);

// Tenant user management (CREAT/READ/UPDATE/DELETE User of the Tenant?)
router.post('/users', authMiddleware(["manage_users"]), createTenantUser);
router.get('/users', authMiddleware(["manage_users"]), getTenantUsers);
router.put('/users/:id', authMiddleware(["manage_users"]), updateTenantUser);
router.delete('/users/:id', authMiddleware(["manage_users"]), deleteTenantUser);

module.exports = router;

