
// /models/navitechGpsRawData.js
// Date: 23 March 2026
// // To capture Navitec GPS Devce Raw Data without parsing for analysis and mapping

const mongoose = require('mongoose');

const navitechGpsRawDataSchema = new mongoose.Schema({
  raw_data: {
    type: Buffer,
    required: true
  },
  header: {
    type: String,
    required: false
  },
  received_at: {
    type: Date,
    default: Date.now
  }
}, { collection: "navitech_gpsrawdata" });

module.exports = mongoose.model("NavitechGpsRawData", navitechGpsRawDataSchema);

