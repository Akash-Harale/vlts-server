const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
    {
        entityName: {
            type: String,
            required: true,
            trim: true,
        },
        clientContactName: {
            type: String,
            required: true,
            trim: true,
        },
        mobileNumber: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        address: {
            type: String,
            required: true,
        },
        pincode: {
            type: String,
            required: true,
        },
        gstNumber: {
            type: String,
            trim: true,
        },
        cinNumber: {
            type: String,
            trim: true,
        },
        tenant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tenant",
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Client", clientSchema);
