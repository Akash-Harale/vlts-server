
// /models/driverVehicleAssignmentArchive.js
const mongoose = require("mongoose");

const driverVehicleAssignmentArchiveSchema = new mongoose.Schema(
  {
    driver_id: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
    vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    route_id: { type: mongoose.Schema.Types.ObjectId, ref: "Route", default: null },
    from_datetime: Date,
    to_datetime: Date,
    instructions: String,
    status: String,
    archived_at: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.DriverVehicleAssignmentArchive ||
  mongoose.model("DriverVehicleAssignmentArchive", driverVehicleAssignmentArchiveSchema);

  