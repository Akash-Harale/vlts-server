
// middleware/authMiddleware.js
// Purpose: Validate JWT and enforce role-based privileges
/*
Gatekeeper for all APIs:
Platform routes → require system‑level privileges.
Tenant routes → require tenant‑level privileges.
Client routes → require client‑level privileges (create_resources, update_resources, manage_client_users, etc.).

Example Usages:

For Super Admin role management routes:
router.post('/roles', authMiddleware(['manage_roles']), roleController.createRole);

For Tenant fleet management:
router.post('/vehicles', authMiddleware(['assign_resources']), vehicleController.createVehicle);

For Client trip creation:
router.post('/trips', authMiddleware(['create_resources']), tripController.createTrip);

*/

const jwt = require('jsonwebtoken');
const Role = require('../models/roleModel');

/**
 * Middleware to validate JWT and check privileges
 * @param {Array<string>} requiredPrivileges - Privileges required to access the route
 */
function authMiddleware(requiredPrivileges = []) {
  return async (req, res, next) => {
    try {
      // Step 1: Validate Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authorization token missing" });
      }

      // Step 2: Verify JWT
      const token = authHeader.split(" ")[1];
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      // Attach decoded payload to request
      // Expected payload: { id, role, emp_id, tenant_id, client_profile_id, privileges }
      req.user = decoded;

      // Step 3: Privilege check
      // Prefer privileges embedded in JWT to avoid DB lookup every time
      let userPrivileges = decoded.privileges;

      if (!userPrivileges || userPrivileges.length === 0) {
        // Fallback: fetch role document if privileges not in token
        const roleDoc = await Role.findOne({ name: decoded.role });
        if (!roleDoc) {
          return res.status(403).json({ error: "Role not recognized" });
        }
        userPrivileges = roleDoc.privileges;
        req.user.privileges = userPrivileges;

      }

      
      // Step 4: Enforce required privileges
      if (requiredPrivileges.length > 0) {
        const hasPrivilege = requiredPrivileges.every(p =>
          userPrivileges.includes(p)
        );

        if (!hasPrivilege) {
          return res.status(403).json({ error: "Insufficient privileges" });
        }
      }

      // Step 5: Proceed
      next();
    } catch (err) {
      console.error("AuthMiddleware Error:", err);
      return res.status(500).json({ error: "Authentication middleware error" });
    }
  };
}

module.exports = authMiddleware;














// const jwt = require('jsonwebtoken');
// const Role = require('../models/roleModel');

// /**
//  * Middleware to validate JWT and check privileges
//  * @param {Array<string>} requiredPrivileges
//  */
// function authMiddleware(requiredPrivileges = []) {
//   return async (req, res, next) => {
//     try {
//       const authHeader = req.headers.authorization;
//       if (!authHeader || !authHeader.startsWith("Bearer ")) {
//         return res.status(401).json({ error: "No token provided" });
//       }

//       const token = authHeader.split(" ")[1];
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);

//       req.user = decoded; // { id, role, emp_id }

//       // Fetch role details
//       const roleDoc = await Role.findOne({ name: decoded.role });
//       if (!roleDoc) {
//         return res.status(403).json({ error: "Role not found" });
//       }

//       // Check privileges
//       const hasPrivilege = requiredPrivileges.every(p => roleDoc.privileges.includes(p));
//       if (!hasPrivilege) {
//         return res.status(403).json({ error: "Insufficient privileges" });
//       }

//       next();
//     } catch (err) {
//       return res.status(401).json({ error: "Invalid token" });
//     }
//   };
// }

// module.exports = authMiddleware;

