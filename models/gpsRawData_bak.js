// models/gpsRawData.js
const mongoose = require('mongoose');

const gpsRawDataSchema = new mongoose.Schema({
    imei: { type: String, required: true },
    raw_payload: { type: Object, required: true },
    raw_data: { type: Buffer },
    received_at: { type: Date, default: Date.now },
    processed: { type: Boolean, default: false },
    error: { type: String, default: null }
});

gpsRawDataSchema.index({ imei: 1, received_at: -1 });

module.exports = mongoose.model('GPSRawData', gpsRawDataSchema);

/*
Sample Data:

{
  "imei": "356938035643809",
  "raw_payload": { "lat": 28.6139, "lon": 77.2090, "speed": 65, "direction": 142 },
  "received_at": "2026-02-28T00:45:00Z"
}
*/

