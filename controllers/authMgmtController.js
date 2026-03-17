const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

// Unified token generation
function generateTokens(user) {
    const payload = {
        id: user._id,
        role: user.role.name,
        emp_id: user.emp_id,
        tenant_id: user.tenant_id || null,
        client_id: user.client_id || null
    };

    const accessToken = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
    );

    const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
    );

    return { accessToken, refreshToken };
}

/**
 * Unified Login for all roles (super_admin, tenant_admin, tenant_user)
 */
exports.unifiedLogin = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email }).populate('role');
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const { accessToken, refreshToken } = generateTokens(user);

        await logger.audit(
            user.emp_id, 
            user.role.name, 
            "login", 
            "user", 
            `Login successful as ${user.role.name}`, 
            "success", 
            user.tenant_id || null, 
            null
        );

        res.json({ 
            accessToken, 
            refreshToken, 
            user: { 
                id: user._id, 
                role: user.role.name, 
                tenant_id: user.tenant_id,
                client_id: user.client_id
            } 
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Unified Refresh Token
 */
exports.unifiedRefresh = async (req, res, next) => {
    const { token, refreshToken: bodyRefreshToken } = req.body;
    const incomingToken = token || bodyRefreshToken;
    
    if (!incomingToken) return res.status(401).json({ error: "Refresh token required" });

    try {
        const decoded = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id).populate('role');
        if (!user) {
            return res.status(403).json({ error: "User not found" });
        }

        const { accessToken, refreshToken } = generateTokens(user);
        res.json({ accessToken, refreshToken });
    } catch (err) {
        res.status(403).json({ error: "Invalid or expired refresh token" });
    }
};

/**
 * Unified Profile Request
 */
exports.getUnifiedProfile = async (req, res, next) => {
    try {
        res.json({ 
            user: { 
                id: req.user.id, 
                role: req.user.role, 
                emp_id: req.user.emp_id, 
                tenant_id: req.user.tenant_id,
                client_id: req.user.client_id 
            } 
        });
    } catch (err) {
        next(err);
    }
};
