  // routes/tenantAdminRoutes.js
  // Purpose: Tenant Admin APIs (auth + manage resources inside tenant)
  // Tenant - Login, refresh, logout plus: Tenant User Management
  // 21 March 2026

  const express = require('express');
const router = express.Router();
const {
  tenantLogin,
  tenantLogout,
  tenantRefresh
} = require('../controllers/tenantAdminAuthController');

const {
  createTenantUser,
  getTenantUsers,
  updateTenantUser,
  deleteTenantUser,getTenantUserById
} = require('../controllers/tenantUserController');

const authMiddleware = require('../middleware/authMiddleware');

// Authentication (shared for all tenant roles)
router.post('/login', tenantLogin);

// No privilege check needed, just ensure token is valid
router.post('/logout', authMiddleware(), tenantLogout);

router.post('/refresh', tenantRefresh);

// Tenant user management (Tenant Admin only)
router.post('/users', authMiddleware(["create_user"]), createTenantUser);
router.get('/users', authMiddleware(["read_user"]), getTenantUsers);
router.get('/users/:id', authMiddleware(["read_user"]), getTenantUserById);
router.put('/users/:id', authMiddleware(["update_user"]), updateTenantUser);
router.delete('/users/:id', authMiddleware(["delete_user"]), deleteTenantUser);

module.exports = router;










// // routes/tenantAdminRoutes.js
// // Purpose: Tenant Admin APIs (auth + manage resources inside tenant)

// const express = require('express');
// const router = express.Router();
// const {
//   tenantAdminLogin,
//   tenantAdminLogout,
//   tenantAdminRefresh
// } = require('../controllers/tenantAdminAuthController');

// const {
//   createTenantUser,
//   getTenantUsers,
//   updateTenantUser,
//   deleteTenantUser
// } = require('../controllers/tenantUserController');

// const authMiddleware = require('../middleware/authMiddleware');

// // Authentication
// router.post('/login', tenantAdminLogin);
// router.post('/logout', authMiddleware(["manage_users"]), tenantAdminLogout);
// router.post('/refresh', tenantAdminRefresh);

// // Tenant user management (CREAT/READ/UPDATE/DELETE User of the Tenant?)
// router.post('/users', authMiddleware(["manage_users"]), createTenantUser);
// router.get('/users', authMiddleware(["manage_users"]), getTenantUsers);
// router.put('/users/:id', authMiddleware(["manage_users"]), updateTenantUser);
// router.delete('/users/:id', authMiddleware(["manage_users"]), deleteTenantUser);

// module.exports = router;

