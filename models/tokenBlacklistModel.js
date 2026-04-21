// models/tkenBlacklistModel.js
// 21 March 2026
/*
>> Key Points: 
token → the refresh token string (unique, required).
user_id → reference to the user who owned the token.
reason → why the token was blacklisted (default: "logout").
timestamp → when the token was blacklisted.
Stored in a dedicated collection: token_blacklist.

>> This model integrates with the shared tokenService.js. 
    > On logout, blacklistToken() will be called, and 
    > on refresh you check verifyRefreshToken() to ensure the token isn’t blacklisted.

TBD: Define scheduled cleanup job (using node-cron) to automatically purge expired blacklisted tokens 
    so the collection doesn’t grow indefinitely.

    OR using TTL as below:

>> How It Works
When blacklist a token, set expiresAt equal to the token’s natural expiry 
(e.g., refresh token expiry time).
MongoDB’s TTL index will automatically delete the document once expiresAt is reached.
No cron job or manual cleanup needed — the database handles it.

Example Flow
User logs out → you call blacklistToken(token, userId).
tokenService decodes the refresh token, sets expiresAt to its natural expiry.
MongoDB automatically deletes the blacklist entry when expiresAt passes.
No cron jobs or manual cleanup needed.
*/

const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String,
        default: "logout"
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true,
    }
},
    {
        collection: 'token_blacklist'
    });

// TTL index: documents expire exactly at expiresAt
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);

