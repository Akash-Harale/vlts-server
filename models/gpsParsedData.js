// models/gpsParsedData.js
// 28 March 2026

const mongoose = require("mongoose");

const gpsProcessedDataSchema = new mongoose.Schema({
  raw_packet: { type: String, required: true },
  imei: { type: String, index: true },
  data_type: { 
    type: String, 
    enum: ["Login", "Tracking", "Health", "Emergency", "Unknown"], 
    required: true 
  },
  // Full audit trace: each field stored with index, optional name, and value
  parsed_fields: [{
    index: { type: Number, required: true },
    field: { type: String },   // optional descriptive name (e.g., "latitude")
    value: { type: String }
  }],
  received_at: { type: Date, index: true }
}, { collection: "gpsProcessedData" });

gpsProcessedDataSchema.index({ imei: 1, received_at: -1 });

module.exports = mongoose.model("GpsProcessedData", gpsProcessedDataSchema);

/**  Sample Documents 
 * 
 * Sample Document (Health Packet)
 * {
  "_id": "660f1a2b9c8f4a1234567890",
  "raw_packet": "$Header,NAVITECH,NAVI140-5.2 25-090-2024,861903298000214,50,20,0.00,0.00,15,60,0000,1.1,1.1*02",
  "imei": "861903298000214",
  "data_type": "Health",
  "parsed_fields": [
    { "index": 0, "field": "header", "value": "$Header" },
    { "index": 1, "field": "vendor_id", "value": "NAVITECH" },
    { "index": 2, "field": "firmware_version", "value": "NAVI140-5.2 25-090-2024" },
    { "index": 3, "field": "imei", "value": "861903298000214" },
    { "index": 4, "field": "battery_percentage", "value": "50" },
    { "index": 5, "field": "low_battery_threshold", "value": "20" },
    { "index": 6, "field": "memory_percentage1", "value": "0.00" },
    { "index": 7, "field": "memory_percentage2", "value": "0.00" },
    { "index": 8, "field": "ignition_on_interval", "value": "15" },
    { "index": 9, "field": "ignition_off_interval", "value": "60" },
    { "index": 10, "field": "digital_inputs", "value": "0000" },
    { "index": 11, "field": "analog_input1", "value": "1.1" },
    { "index": 12, "field": "analog_input2_checksum", "value": "1.1*02" }
  ],
  "received_at": "2026-03-28T17:37:00.000Z"
}

Sample Document (Login Packet)
{
  "_id": "660f1a2b9c8f4a1234567891",
  "raw_packet": "$Header,NAVITECH,KA01I2000,861693034634154,NAVI140-5.0T19 12-12-2014,AIS140,23.796492,N,85.574791,E*50",
  "imei": "861693034634154",
  "data_type": "Login",
  "parsed_fields": [
    { "index": 0, "field": "header", "value": "$Header" },
    { "index": 1, "field": "vendor_id", "value": "NAVITECH" },
    { "index": 2, "field": "vehicle_reg", "value": "KA01I2000" },
    { "index": 3, "field": "imei", "value": "861693034634154" },
    { "index": 4, "field": "firmware_version", "value": "NAVI140-5.0T19 12-12-2014" },
    { "index": 5, "field": "protocol_marker", "value": "AIS140" },
    { "index": 6, "field": "latitude", "value": "23.796492" },
    { "index": 7, "field": "latitude_dir", "value": "N" },
    { "index": 8, "field": "longitude", "value": "85.574791" },
    { "index": 9, "field": "longitude_dir", "value": "E*50" }
  ],
  "received_at": "2026-03-28T17:37:00.000Z"
}


Sample Document (Tracking Packet)
{
  "_id": "660f1a2b9c8f4a1234567892",
  "raw_packet": "$Header,NAVITECH,NAVI140-5.2,25-09-2024,NR,1,L,862380202300004,DL4SDP2021,1,03122024,090830,18.523696,N,073.815811,E,40.5,180.0,7,704.5,1.2,0.9,VI,1,1,12.5,3.7,0,OK,20,404,10,140E,9346,...*62",
  "imei": "862380202300004",
  "data_type": "Tracking",
  "parsed_fields": [
    { "index": 0, "field": "header", "value": "$Header" },
    { "index": 1, "field": "vendor_id", "value": "NAVITECH" },
    { "index": 2, "field": "firmware_version", "value": "NAVI140-5.2" },
    { "index": 3, "field": "firmware_date", "value": "25-09-2024" },
    { "index": 4, "field": "packet_type", "value": "NR" },
    { "index": 5, "field": "message_id", "value": "1" },
    { "index": 6, "field": "packet_status", "value": "L" },
    { "index": 7, "field": "imei", "value": "862380202300004" },
    { "index": 8, "field": "vehicle_reg", "value": "DL4SDP2021" },
    { "index": 9, "field": "gps_fix", "value": "1" },
    { "index": 10, "field": "date", "value": "03122024" },
    { "index": 11, "field": "time", "value": "090830" },
    { "index": 12, "field": "latitude", "value": "18.523696" },
    { "index": 13, "field": "latitude_dir", "value": "N" },
    { "index": 14, "field": "longitude", "value": "073.815811" },
    { "index": 15, "field": "longitude_dir", "value": "E" },
    { "index": 16, "field": "speed", "value": "40.5" },
    { "index": 17, "field": "heading", "value": "180.0" },
    { "index": 18, "field": "satellites", "value": "7" },
    { "index": 19, "field": "altitude", "value": "704.5" },
    { "index": 20, "field": "pdop", "value": "1.2" },
    { "index": 21, "field": "hdop", "value": "0.9" },
    { "index": 22, "field": "operator", "value": "VI" },
    { "index": 23, "field": "ignition_status", "value": "1" },
    { "index": 24, "field": "main_power_status", "value": "1" },
    { "index": 25, "field": "main_voltage", "value": "12.5" },
    { "index": 26, "field": "internal_battery_voltage", "value": "3.7" },
    { "index": 27, "field": "emergency_status", "value": "0" },
    { "index": 28, "field": "tamper_alert", "value": "OK" },
    { "index": 29, "field": "gsm_signal_strength", "value": "20" },
    { "index": 30, "field": "mcc", "value": "404" },
    { "index": 31, "field": "mnc", "value": "10" },
    { "index": 32, "field": "lac", "value": "140E" },
    { "index": 33, "field": "cell_id", "value": "9346" },
    { "index": 47, "field": "frame_number", "value": "1234" },
    { "index": 54, "field": "checksum", "value": "*62" }
  ],
  "received_at": "2026-03-28T17:37:00.000Z"
}


Sample Document (Emergency Packet)
{
  "_id": "660f1a2b9c8f4a1234567893",
  "raw_packet": "$Header,NAVITECH,EMR,862380202300004,NM,27112024114628,A,18.523696,N,073.815811,E,704.5,00.0,5048852,G,DL4SDP2021,9643908282,140E,9346,*62",
  "imei": "862380202300004",
  "data_type": "Emergency",
  "parsed_fields": [
    { "index": 0, "field": "header", "value": "$Header" },
    { "index": 1, "field": "vendor_id", "value": "NAVITECH" },
    { "index": 2, "field": "message_type", "value": "EMR" },
    { "index": 3, "field": "imei", "value": "862380202300004" },
    { "index": 4, "field": "packet_type", "value": "NM" },
    { "index": 5, "field": "datetime", "value": "27112024114628" },
    { "index": 6, "field": "gps_validity", "value": "A" },
    { "index": 7, "field": "latitude", "value": "18.523696" },
    { "index": 8, "field": "latitude_dir", "value": "N" },
    { "index": 9, "field": "longitude", "value": "073.815811" },
    { "index": 10, "field": "longitude_dir", "value": "E" },
    { "index": 11, "field": "altitude", "value": "704.5" },
    { "index": 12, "field": "speed", "value": "00.0" },
    { "index": 13, "field": "distance", "value": "5048852" },
    { "index": 14, "field": "provider", "value": "G" },
    { "index": 15, "field": "vehicle_reg", "value": "DL4SDP2021" },
    { "index": 16, "field": "reply_number", "value": "9643908282" },
    { "index": 17, "field": "lac", "value": "140E" },
    { "index": 18, "field": "cell_id", "value": "9346" },
    { "index": 19, "field": "checksum", "value": "*62" }
  ],
  "received_at": "2026-03-28T17:37:00.000Z"
}

*/

