// utils/gpsParser.js
function parseGpsPacket(rawStr) {
  const fields = rawStr.split(",").map(f => f.trim());
  return {
    imei: fields[6],              // adjust index based on packet type
    vendor_id: fields[1],
    packet_type: fields[3],
    payload: fields               // keep full array for debugging
  };
}

module.exports = { parseGpsPacket };

