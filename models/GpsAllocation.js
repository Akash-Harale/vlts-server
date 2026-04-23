const mongoose = require("mongoose");

const gpsAllocationSchema = new mongoose.Schema({
  technicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  salesPersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  gpsId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GpsDevice",
  },
  allocatedDate: {
    type: Date,
    default: Date.now,
  },
  unallocatedDate: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model("GpsAllocation", gpsAllocationSchema);
