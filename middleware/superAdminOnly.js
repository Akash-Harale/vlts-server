// middleware/superAdminOnly.js
const Role = require('../models/roleModel');

/**
 * Middleware to ensure only Super Admin can access the route.
 */
async function superAdminOnly(req, res, next) {
  try {
    const role = await Role.findOne({ name: req.user.role });
    if (!role || role.name !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Super Admin only" });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = superAdminOnly;

