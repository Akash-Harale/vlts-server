// utils/gpsParser.js

/**
 * Parse a raw GPS packet string.
 *
 * Supports two formats:
 *  1. JSON  – sent by the simulator and modern devices:
 *       {"imei":"...","lat":...,"lon":...,"speed":...,"direction":...}
 *  2. CSV / comma-delimited – legacy NMEA-style packets:
 *       <vendor>,<...>,<...>,<packetType>,<...>,<...>,<imei>,...
 *
 * Returns a normalised object with at minimum:
 *   { imei, lat, lon, speed, direction, payload }
 */
function parseGpsPacket(rawStr) {
  // ── JSON path ──────────────────────────────────────────────────────────────
  if (rawStr.startsWith("{")) {
    try {
      const json = JSON.parse(rawStr);
      return {
        imei:       json.imei       ?? null,
        lat:        json.lat        ?? null,
        lon:        json.lon        ?? null,
        speed:      json.speed      ?? null,
        direction:  json.direction  ?? null,
        vendor_id:  json.vendor_id  ?? null,
        packet_type: json.packet_type ?? "json",
        payload:    json               // keep full object for downstream use
      };
    } catch (_) {
      // fall through to CSV parser if JSON.parse fails
    }
  }

  // ── CSV / comma-delimited path ─────────────────────────────────────────────
  const fields = rawStr.split(",").map(f => f.trim());
  return {
    imei:        fields[6] ?? null,   // adjust index to match your device protocol
    vendor_id:   fields[1] ?? null,
    packet_type: fields[3] ?? null,
    lat:         fields[7] ? parseFloat(fields[7]) : null,
    lon:         fields[8] ? parseFloat(fields[8]) : null,
    speed:       fields[9] ? parseFloat(fields[9]) : null,
    direction:   fields[10] ? parseFloat(fields[10]) : null,
    payload:     fields     // keep full array for debugging
  };
}

module.exports = { parseGpsPacket };


