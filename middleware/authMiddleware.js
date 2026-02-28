// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const Role = require('../models/roleModel');

/**
 * Middleware to validate JWT and check privileges
 * @param {Array<string>} requiredPrivileges
 */
function authMiddleware(requiredPrivileges = []) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = decoded; // { id, role, emp_id }

      // Fetch role details
      const roleDoc = await Role.findOne({ name: decoded.role });
      if (!roleDoc) {
        return res.status(403).json({ error: "Role not found" });
      }

      // Check privileges
      const hasPrivilege = requiredPrivileges.every(p => roleDoc.privileges.includes(p));
      if (!hasPrivilege) {
        return res.status(403).json({ error: "Insufficient privileges" });
      }

      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

module.exports = authMiddleware;

