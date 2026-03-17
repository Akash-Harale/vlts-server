const express = require('express');
const router = express.Router();
const authMgmtController = require('../controllers/authMgmtController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/login', authMgmtController.unifiedLogin);
router.post('/refresh', authMgmtController.unifiedRefresh);

// Protected routes (require any privilege to check profile)
router.get('/profile', authMiddleware([]), authMgmtController.getUnifiedProfile);

module.exports = router;
