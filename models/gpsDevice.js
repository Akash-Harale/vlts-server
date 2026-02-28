// models/gpsDevice.js
// Mongoose schema for GPS devices with self-healing validation
/*
GPSDevice model with a self‑healing validation hook. 
This hook will automatically mark a device as FAULTY if repeated mapping attempts fail 
(for example, due to tamper detection, health issues, or validation errors). 
This way, operators don’t have to manually update the device status every time.
*/
const mongoose = require('mongoose');

const gpsDeviceSchema = new mongoose.Schema({
  imei: { type: String, required: true, unique: true },   // Unique IMEI
  serial_number: { type: String, required: true, unique: true },
  manufacturer: { type: String },
  model: { type: String },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'FAULTY'], default: 'ACTIVE' },
  installed_on: { type: Date },
  created_at: { type: Date, default: Date.now },
  failed_attempts: { type: Number, default: 0 } // Track failed mapping attempts
});

// Indexes for faster queries
gpsDeviceSchema.index({ imei: 1 });
gpsDeviceSchema.index({ serial_number: 1 });

// Validation method: only ACTIVE devices can be mapped
gpsDeviceSchema.methods.canBeMapped = function () {
  if (this.status !== 'ACTIVE') {
    console.error(` [VALIDATION ERROR] Device ${this._id} is ${this.status} and cannot be mapped`);
    return false;
  }
  return true;
};

// Middleware: if failed attempts exceed threshold, mark device as FAULTY
gpsDeviceSchema.pre('save', function (next) {
  if (this.failed_attempts >= 3 && this.status === 'ACTIVE') {
    console.warn(` [AUTO-UPDATE] Device ${this._id} exceeded failed attempts. Marking as FAULTY.`);
    this.status = 'FAULTY';
  }
  next();
});

module.exports = mongoose.model('GPSDevice', gpsDeviceSchema);
