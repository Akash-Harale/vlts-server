// /models/driverVehicleAssignment.js
/*
Example Behavior
Insert #1: Driver A, Vehicle X, 09:00 → 11:00 →  Success
Insert #2: Driver A, Vehicle X, 09:00 → 11:00 →  Duplicate error (DB index)
Insert #3: Driver A, Vehicle Y, 10:00 → 12:00 →  Overlap error (controller logic)
Insert #4: Driver B, Vehicle X, 10:00 → 12:00 →  Overlap error (controller logic)
Insert #5: Driver B, Vehicle Y, 12:00 → 13:00 →  Success
*/
const mongoose = require("mongoose");

const driverVehicleAssignmentSchema = new mongoose.Schema(
  {
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    driver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    vehicle_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },
    route_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      default: null,
    },
    from_datetime: {
      type: Date,
      required: true,
    },
    to_datetime: {
      type: Date,
      required: true,
    },
    instructions: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "EXPIRED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

//  Prevent duplicate driver–vehicle pair
driverVehicleAssignmentSchema.index(
  { driver_id: 1, vehicle_id: 1, from_datetime: 1, to_datetime: 1 },
  { unique: true }
);

//  Validate date range
driverVehicleAssignmentSchema.pre("validate", function (next) {
  if (this.from_datetime >= this.to_datetime) {
    return next(new Error("from_datetime must be before to_datetime"));
  }
  next();
});

module.exports =
  mongoose.models.DriverVehicleAssignment ||
  mongoose.model("DriverVehicleAssignment", driverVehicleAssignmentSchema);
