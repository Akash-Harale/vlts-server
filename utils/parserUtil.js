// parserUtil.js
// Utility to classify and parse GPS packets into structured fields with audit traceability

require("dotenv").config();
const VERBOSE = process.env.VERBOSE_LOGGING === "true";

// Lookup maps for each packet type of AIS-140 compliant gps devices protocol
const loginFieldMap = {
  0: "header", 1: "vendor_id", 2: "vehicle_reg", 3: "imei",
  4: "firmware_version", 5: "protocol_marker", 6: "latitude",
  7: "latitude_dir", 8: "longitude", 9: "longitude_dir", 10: "checksum"
};

const emergencyFieldMap = {
  0: "header", 1: "vendor_id", 2: "message_type", 3: "imei",
  4: "packet_type", 5: "datetime", 6: "gps_validity", 7: "latitude",
  8: "latitude_dir", 9: "longitude", 10: "longitude_dir", 11: "altitude",
  12: "speed", 13: "distance", 14: "provider", 15: "vehicle_reg",
  16: "reply_number", 17: "lac", 18: "cell_id", 19: "checksum"
};

const trackingFieldMap = {
  0: "header", 1: "vendor_id", 2: "firmware_version", 
  3: "packet_type", 4: "message_id", 5: "packet_status", 6: "imei",
  7: "vehicle_reg", 8: "gps_fix", 9: "date", 10: "time", 11: "latitude",
  12: "latitude_dir", 13: "longitude", 14: "longitude_dir", 15: "speed",
  16: "heading", 17: "satellites", 18: "altitude", 19: "pdop", 20: "hdop",
  21: "operator", 22: "ignition_status", 23: "main_power_status",
  24: "main_voltage", 25: "internal_battery_voltage", 26: "emergency_status",
  27: "tamper_alert", 28: "gsm_signal_strength", 29: "mcc", 30: "mnc",
  31: "lac", 32: "cell_id", 33: "gsm_nmr_1st", 34: "lac_nmr_1st", 35: "cell_id_nmr_1st",
  36: "gsm_nmr_2nd", 37: "lac_nmr_2nd", 38: "cell_id_nmr_2nd",
  39: "gsm_nmr_3rd", 40: "lac_nmr_3rd", 41: "cell_id_nmr_3rd",
  42: "gsm_nmr_4th", 43: "lac_nmr_4th", 44: "cell_id_nmr_4th", 45: "digital_input",
  46: "digital_output", 47: "frame_number", 48: "analog_input1", 49: "analog_input2",
  50: "delta_distance", 51: "ota_response", 52: "checksum"
};

const healthFieldMap = {
  0: "header", 1: "vendor_id", 2: "firmware_version", 3: "imei",
  4: "battery_percentage", 5: "low_battery_threshold",
  6: "memory_percentage1", 7: "memory_percentage2",
  8: "ignition_on_interval", 9: "ignition_off_interval",
  10: "digital_inputs", 11: "analog_input1", 12: "analog_input2_checksum"
};

// Helper: convert fields into key/value object
function buildParsedObject(fields, fieldMap) {
  const obj = {};
  fields.forEach((val, idx) => {
    const key = fieldMap[idx] || `field_${idx}`;
    obj[key] = val.trim();
  });
  return obj;
}

// Main parser
function parsePacket(rawPacket) {
  const fields = rawPacket.split(",").map(f => f.trim());

  // LOGIN PACKET
  if (fields[5] === "AIS140") {
    return {
      data_type: "Login",
      imei: fields[3],
      parsed_data: buildParsedObject(fields, loginFieldMap)
    };
  }

  // EMERGENCY PACKET
  if (fields[2] === "EMR" || fields[2] === "SEM") {
    return {
      data_type: "Emergency",
      imei: fields[3],
      parsed_data: buildParsedObject(fields, emergencyFieldMap)
    };
  }

  // TRACKING PACKET
  const packetTypes = ["NR","EA","TA","HP","IN","IF","BD","BR","BL"];
  if (packetTypes.includes(fields[3])) {
    return {
      data_type: "Tracking",
      imei: fields[6],
      parsed_data: buildParsedObject(fields, trackingFieldMap)
    };
  }

  // HEALTH PACKET
  if (fields.length === 13 && fields[5] !== "AIS140") {
    return {
      data_type: "Health",
      imei: fields[3],
      parsed_data: buildParsedObject(fields, healthFieldMap)
    };
  }

  // UNKNOWN fallback
  const obj = {};
  fields.forEach((val, idx) => { obj[`field_${idx}`] = val; });
  return { data_type: "Unknown", imei: null, parsed_data: obj };
}

// Verbose logger for manual verification
function logParsedPacket(parsed, receivedAt) {
  if (!VERBOSE) return;

  console.log("=== GPS Packet Summary ===");
  console.log(`Type: ${parsed.data_type} : IMEI: ${parsed.imei || "N/A"} : VENDOR_ID: ${parsed.vendor_id || "N/A"}`);
  console.log(`Received At: ${receivedAt.toISOString()}`);
  console.log("=== Parsed Fields ===");
  Object.entries(parsed.parsed_data).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
}

module.exports = { parsePacket, logParsedPacket };
