const Role = require('../models/roleModel');

/**
 * Declarative Authorization Middleware
 * @param {string} resource - The resource being accessed (e.g., 'vehicles', 'clients')
 * @param {string} action - The action performed (e.g., 'create', 'read', 'update', 'delete')
 */
const authorize = (resource, action) => {
    return async (req, res, next) => {
        try {
            // req.user is set by authMiddleware (JWT verification)
            if (!req.user || !req.user.role) {
                return res.status(401).json({ error: "Unauthorized: No user role found" });
            }

            const roleDoc = await Role.findOne({ name: req.user.role });
            if (!roleDoc) {
                return res.status(403).json({ error: "Forbidden: Role not found" });
            }

            // 1. Super Admin bypass
            if (roleDoc.privileges.includes('all')) {
                return next();
            }

            // 2. Resource-Action check
            const requiredPrivilege = `${resource}:${action}`;
            
            // Also allow global patterns if needed (e.g., 'vehicles:*')
            const hasPrivilege = roleDoc.privileges.some(p => 
                p === requiredPrivilege || p === `${resource}:*` || p === '*'
            );

            if (!hasPrivilege) {
                return res.status(403).json({ error: `Insufficient privileges for ${action} on ${resource}` });
            }

            next();
        } catch (err) {
            console.error("Authorization Middleware Error:", err.message);
            res.status(500).json({ error: "Internal server error during authorization" });
        }
    };
};

module.exports = authorize;
