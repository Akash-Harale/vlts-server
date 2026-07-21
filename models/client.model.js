// models/clientProfileModel.js

const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    entity_name: { type: String, required: true },
    contact_name: { type: String, required: true },
    gst_number: { type: String, required: true, unique: true },
    cin_number: { type: String, required: true, unique: true },
    address1: { type: String },
    address2: { type: String },
    city: { type: String },
    district: { type: String },
    state: { type: String },
    pincode: { type: String },
    mobile_number: { type: String },
    whatsapp_number: { type: String },
    email_id: { type: String, required: true },
    client_type: { type: String, enum: ["fleet admin", "school admin", "individual owner"], default: "fleet admin" },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Client || mongoose.model('Client', clientSchema);















// const mongoose = require("mongoose");

// const clientSchema = new mongoose.Schema(
//     {
//         entityName: {
//             type: String,
//             required: true,
//             trim: true,
//         },
//         clientContactName: {
//             type: String,
//             required: true,
//             trim: true,
//         },
//         mobileNumber: {
//             type: String,
//             required: true,
//             trim: true,
//         },
//         email: {
//             type: String,
//             required: true,
//             lowercase: true,
//             trim: true,
//         },
//         address: {
//             type: String,
//             required: true,
//         },
//         pincode: {
//             type: String,
//             required: true,
//         },
//         gstNumber: {
//             type: String,
//             trim: true,
//         },
//         cinNumber: {
//             type: String,
//             trim: true,
//         },
//     },
//     { timestamps: true }
// );

// module.exports = mongoose.model("Client", clientSchema);
