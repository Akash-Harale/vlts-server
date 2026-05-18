// utils/gpsParser.js

/**
 * Parse a raw GPS packet string.
 *
 * Supports:
 *  1. JSON – simulator / modern devices:
 *       {"imei":"...","lat":...,"lon":...,"speed":...,"direction":...}
 *
 *  2. NAVITECH "$Header" variant (real hardware):
 *       $Header,NAVITECH,NAVI5.0,NR,1,L,<IMEI>,VA01I2019,0,<DDMMYYYY>,<HHMMSS>,
 *       <LAT>,<N/S>,<LON>,<E/W>,<SPEED>,<DIR>,...
 *       idx:   0       1       2    3   4 5 6              7           8  9       10
 *                                                                      11  12     13  14   15    16
 *
 *  3. NAVITECH "$,NMP" variant (alternate firmware):
 *       $,NMP,NAVITECH,NAVI5.0,NR,01,L,<IMEI>,VA01I2019,1,<DDMMYYYY>,<HHMMSS>,
 *       <LAT>,<N/S>,<LON>,<E/W>,<SPEED>,<DIR>,...
 *       idx: 0  1    2       3    4   5  6 7               8           9  10      11
 *                                                                      12  13     14  15   16    17
 *
 * Always returns:
 *   { imei, lat, lon, speed, direction, vendor_id, packet_type, payload }
 * where `payload` is always a plain object (never a raw array).
 */
function parseGpsPacket(rawStr) {

  // ── 1. JSON path ───────────────────────────────────────────────────────────
  if (rawStr.startsWith('{')) {
    try {
      const json = JSON.parse(rawStr);
      return {
        imei: json.imei ?? null,
        lat: json.lat ?? null,
        lon: json.lon ?? null,
        speed: json.speed ?? null,
        direction: json.direction ?? null,
        vendor_id: json.vendor_id ?? null,
        packet_type: json.packet_type ?? 'json',
        payload: json              // already a plain object
      };
    } catch (_) {
      // fall through to CSV parser
    }
  }

  // ── 2. CSV path ────────────────────────────────────────────────────────────
  const fields = rawStr.split(',').map(f => f.trim());

  let imei, latRaw, ns, lonRaw, ew, speedRaw, dirRaw;

  if (fields[0] === '$Header') {
    // NAVITECH $Header format
    // [0]=$Header [1]=NAVITECH [2]=NAVI5.0 [3]=NR [4]=1 [5]=L [6]=IMEI
    // [7]=VA01I2019 [8]=0 [9]=DDMMYYYY [10]=HHMMSS
    // [11]=LAT [12]=N/S [13]=LON [14]=E/W [15]=SPEED [16]=DIRECTION
    imei = fields[6] ?? null;
    latRaw = fields[11];
    ns = fields[12];
    lonRaw = fields[13];
    ew = fields[14];
    speedRaw = fields[15];
    dirRaw = fields[16];

  } else if (fields[0] === '$' && fields[1] === 'NMP') {
    // NAVITECH $,NMP format
    // [0]=$ [1]=NMP [2]=NAVITECH [3]=NAVI5.0 [4]=NR [5]=01 [6]=L [7]=IMEI
    // [8]=VA01I2019 [9]=1 [10]=DDMMYYYY [11]=HHMMSS
    // [12]=LAT [13]=N/S [14]=LON [15]=E/W [16]=SPEED [17]=DIRECTION
    imei = fields[7] ?? null;
    latRaw = fields[12];
    ns = fields[13];
    lonRaw = fields[14];
    ew = fields[15];
    speedRaw = fields[16];
    dirRaw = fields[17];

  } else {
    // Unknown CSV format — best-effort fallback
    console.warn('[gpsParser] Unknown CSV format, using fallback indices. First field:', fields[0]);
    imei = fields[6] ?? null;
    latRaw = fields[7];
    ns = null;
    lonRaw = fields[8];
    ew = null;
    speedRaw = fields[9];
    dirRaw = fields[10];
  }

  // Parse numeric values and apply N/S, E/W sign
  let lat = latRaw ? parseFloat(latRaw) : null;
  let lon = lonRaw ? parseFloat(lonRaw) : null;
  if (Number.isNaN(lat)) lat = null;
  if (Number.isNaN(lon)) lon = null;
  if (lat !== null && ns === 'S') lat = -lat;
  if (lon !== null && ew === 'W') lon = -lon;

  const speed = speedRaw != null ? (parseFloat(speedRaw) || 0) : null;
  const direction = dirRaw != null ? (parseFloat(dirRaw) || 0) : null;

  // Always return payload as a plain object so buildTelemetry can read .lat/.lon
  const payload = { imei, lat, lon, speed, direction };

  return {
    imei,
    lat,
    lon,
    speed,
    direction,
    vendor_id: fields[1] ?? null,
    packet_type: 'csv',
    payload      // plain object — NOT the raw array
  };
}

module.exports = { parseGpsPacket };
