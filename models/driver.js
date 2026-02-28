// /models/driver.js
const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  driver_name: { type: String, required: true },
  driver_license: { type: String, required: true },
  mobile_number: { type: String, required: true, unique: true },
  email_id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

// driver_id will be auto-generated as _id by MongoDB
module.exports = mongoose.model('Driver', driverSchema);
