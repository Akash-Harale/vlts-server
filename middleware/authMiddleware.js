// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const Role = require('../models/roleModel');

/**
 * Middleware to validate JWT and check privileges
 * @param {Array<string>} requiredPrivileges
 * @param {string} match - 'all' (default, AND) or 'any' (OR)
 */
function authMiddleware(requiredPrivileges = [], match = 'all') {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = decoded; // { id, role, emp_id, tenant_id, client_id }

      // Fetch role details
      const roleDoc = await Role.findOne({ name: decoded.role });
      if (!roleDoc) {
        return res.status(403).json({ error: "Role not found" });
      }

      // 1. Super Admin bypass
      if (roleDoc.privileges.includes('all')) {
        return next();
      }

      // 2. Privilege check based on match strategy
      let hasPrivilege = false;
      if (match === 'any') {
        hasPrivilege = requiredPrivileges.some(p => roleDoc.privileges.includes(p));
      } else {
        hasPrivilege = requiredPrivileges.every(p => roleDoc.privileges.includes(p));
      }

      if (requiredPrivileges.length > 0 && !hasPrivilege) {
        return res.status(403).json({ error: "Insufficient privileges" });
      }

      next();
    } catch (err) {
      console.error("Auth Middleware Error:", err.message);
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

module.exports = authMiddleware;

