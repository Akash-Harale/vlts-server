// models/vehicleDeviceMap.js
// Mongoose schema for mapping GPS devices to vehicles with validation hooks

const mongoose = require("mongoose");

const vehicleDeviceMapSchema = new mongoose.Schema({
  vehicle_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    required: true,
  },
  gps_device_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GPSDevice",
    required: true,
    unique: true
  },
  technician_id: {
    type: String,
    ref: "Technician",
    required: false,
    default: null,
  },

  installation_date: { type: Date, default: Date.now },
  installation_notes: { type: String },
  unmapped_on: { type: Date },
  status: { type: String, enum: ["MAPPED", "UNMAPPED"], default: "MAPPED" },
});

// Indexes for faster lookups
vehicleDeviceMapSchema.index({ vehicle_id: 1, status: 1 });
vehicleDeviceMapSchema.index({ gps_device_id: 1, status: 1 });

// Validation hook: ensure only one active mapping per vehicle
vehicleDeviceMapSchema.pre("save", async function (next) {
  if (this.status === "MAPPED") {
    const existing = await mongoose.model("VehicleDeviceMap").findOne({
      vehicle_id: this.vehicle_id,
      status: "MAPPED",
    });
    if (existing) {
      const err = new Error(
        `Vehicle ${this.vehicle_id} already has an active GPS device mapped`,
      );
      console.error(" [VALIDATION ERROR]", err.message);
      return next(err);
    }
  }
  next();
});

// Validation hook: prevent same device being mapped to multiple vehicles simultaneously
vehicleDeviceMapSchema.pre("save", async function (next) {
  if (this.status === "MAPPED") {
    const existing = await mongoose.model("VehicleDeviceMap").findOne({
      gps_device_id: this.gps_device_id,
      status: "MAPPED",
    });
    if (existing) {
      const err = new Error(
        `GPS Device ${this.gps_device_id} is already mapped to another vehicle`,
      );
      console.error(" [VALIDATION ERROR]", err.message);
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model("VehicleDeviceMap", vehicleDeviceMapSchema);
