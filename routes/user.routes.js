
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { createUser, getUsers, getUserById, updateUser, deleteUser, getRoles } = require('../controllers/user.controller');
const router = express.Router();

module.exports = router;

router.get('/roles', authMiddleware(["read_user"]), getRoles);
router.post('/', authMiddleware(["create_user"]), createUser);
router.get('/', authMiddleware(["read_user"]), getUsers);
router.get('/:id', authMiddleware(["read_user"]), getUserById);
router.put('/:id', authMiddleware(["update_user"]), updateUser);
router.delete('/:id', authMiddleware(["delete_user"]), deleteUser);

