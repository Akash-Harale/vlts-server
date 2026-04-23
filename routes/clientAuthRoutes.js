// /routes/clientAuthRoutes.js

// Client Auth APIs:  Login, Refresh, Logout

// 21 March 2026

const express = require('express');
const router = express.Router();
const {
  clientLogin,
  clientLogout,
  clientRefresh
} = require('../controllers/clientAuthController');

const authMiddleware = require('../middleware/authMiddleware');

// Client login
router.post('/login', clientLogin);

// Client logout
router.post('/logout', authMiddleware(), clientLogout);

// Client refresh
router.post('/refresh', clientRefresh);

module.exports = router;












// // /routes/authRoutes.js
// const express = require('express');
// const router = express.Router();
// const authController = require('../controllers/authController');
// const assignmentController = require('../controllers/assignmentController');

// /*
// POST /api/login
// {
//   "user_id": "driver001",
//   "password": "securePass123"
// }

// Response:
// {
//   "user_id": "driver001",
//   "driver_id": "67a0f1c2e4b1a9d123456789",
//   "driver_name": "Ramesh Kumar"
// }
// */
// router.post('/login', authController.login);

// /*
// GET /api/assignment/driver001

// Response:
// {
//   "user_id": "driver001",
//   "driver_id": "67a0f1c2e4b1a9d123456789",
//   "driver_name": "Ramesh Kumar",
//   "route_id": "67a0f1c2e4b1a9d987654321",
//   "route_name": "Delhi to Agra",
//   "vehicle_id": "67a0f1c2e4b1a9d555555555",
//   "vehicle_regn_number": "UP14AB1234",
//   "assignment_desc": "Daily shuttle service"
// }
// */
// router.get('/assignment/:user_id', assignmentController.getDriverAssignmentDetails);

// router.post('/logout', authController.logout); // NEW logout route

// module.exports = router;


