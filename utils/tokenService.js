// /utils/tokenService.js
// 21 March 2026
/*
The token blacklist model used for logout can invalidate refresh tokens and prevent reuse. 
This way, even if someone steals a refresh token, it won’t work once the user has logged out.

>> Explanation
Shared tokenService centralizes blacklist logic.
Logout → blacklists refresh token.
Refresh → checks blacklist before issuing new tokens.
Audit/Error logs capture every event.
Privilege checks ensure only correct role types can refresh.

>> How It Works
blacklistToken() → Decodes the refresh token, extracts its exp claim, and sets expiresAt.
TTL index in TokenBlacklist ensures MongoDB deletes the document automatically when expiresAt is reached.
isTokenBlacklisted() → Checks if the token exists in the blacklist.
verifyRefreshToken() → Ensures the token isn’t blacklisted and verifies it against the refresh secret.

>> Benefits
No manual cleanup or cron jobs needed.
Blacklist entries expire exactly when the refresh token does.
Keeps your collection lean and self‑maintaining.
*/

const TokenBlacklist = require('../models/tokenBlacklistModel');
const jwt = require('jsonwebtoken');

/**
 * Blacklist a refresh token (e.g., on logout).
 * Automatically sets expiresAt based on token's exp claim.
 * @param {String} token - Refresh token to blacklist
 * @param {String} userId - User ID
 * @param {String} reason - Reason for blacklisting (default: logout)
 */
async function blacklistToken(token, userId, reason = "logout") {
  if (!token) return;

  // Decode refresh token to get expiry
  const decoded = jwt.decode(token);
  let expiresAt = new Date();
  if (decoded && decoded.exp) {
    expiresAt = new Date(decoded.exp * 1000); // exp is in seconds
  }

  await TokenBlacklist.create({
    token,
    user_id: userId,
    reason,
    expiresAt
  });
}

/**
 * Check if a refresh token is blacklisted.
 * @param {String} token - Refresh token to check
 * @returns {Boolean} - true if blacklisted, false otherwise
 */
async function isTokenBlacklisted(token) {
  if (!token) return true; // treat missing token as invalid
  const blacklisted = await TokenBlacklist.findOne({ token });
  return !!blacklisted;
}

/**
 * Verify refresh token and ensure it's not blacklisted.
 * @param {String} token - Refresh token
 * @returns {Object|null} - Decoded payload if valid, null if invalid/blacklisted
 */
async function verifyRefreshToken(token) {
  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) return null;

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}

module.exports = {
  blacklistToken,
  isTokenBlacklisted,
  verifyRefreshToken
};
