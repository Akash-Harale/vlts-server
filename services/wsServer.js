// services/wsServer.js
// WebSocket Server with Replay + Geofence

// services/wsServer.js
const WebSocket = require('ws');
const Telemetry = require('../models/telemetry');
const Geofence = require('../models/geofence');
const turf = require('@turf/turf');

function startWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log(' WebSocket client connected');
    ws.subscriptions = {};
    ws.replayState = { active: false, paused: false, speed: 1 };

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);

        if (data.type === 'subscribe') {
          ws.subscriptions = {
            vehicle_id: data.vehicle_id || null,
            trip_id: data.trip_id || null,
            session_id: data.session_id || null
          };
          console.log(' Client subscription updated:', ws.subscriptions);
        }

        if (data.type === 'replay') {
          console.log(' Handling replay request:', data);
          ws.replayState = { active: true, paused: false, speed: 1 };
          await handleReplay(ws, data);
        }

        if (data.type === 'pause') {
          ws.replayState.paused = true;
          console.log(' Replay paused');
        }

        if (data.type === 'resume') {
          ws.replayState.paused = false;
          console.log(' Replay resumed');
        }

        if (data.type === 'fastforward') {
          ws.replayState.speed = data.speed || 2;
          console.log(` Replay fast-forward set to ${ws.replayState.speed}x`);
        }
      } catch (err) {
        console.error(' WebSocket error:', err.message);
      }
    });
  });

  console.log(' WebSocket server started');
  return wss;
}


function broadcastTelemetry(wss, telemetryDoc) {
  if (!telemetryDoc) return;

  const payload = typeof telemetryDoc.toObject === 'function'
    ? telemetryDoc.toObject()
    : telemetryDoc;

  const totalClients = wss.clients.size;
  console.log(`[WS-BCAST] Total connected WS clients: ${totalClients}`);
  console.log(`[WS-BCAST] Payload vehicle_id=${payload.vehicle_id} | trip_id=${payload.trip_id} | speed=${payload.speed}`);

  // Helper to send payload to all matching clients
  const sendPayload = (geofenceStatus) => {
    const enrichedPayload = { type: 'live', ...payload, geofence_status: geofenceStatus };
    let sentCount = 0;

    wss.clients.forEach((client, idx) => {
      if (client.readyState === WebSocket.OPEN) {
        const { vehicle_id, trip_id, session_id } = client.subscriptions || {};
        const matchVehicle = !vehicle_id || payload.vehicle_id?.toString() === vehicle_id;
        const matchTrip    = !trip_id    || payload.trip_id?.toString()    === trip_id;
        const matchSession = !session_id || payload.session_id             === session_id;

        console.log(`[WS-BCAST] Client sub: vehicle_id=${vehicle_id} trip_id=${trip_id} session_id=${session_id}`);
        console.log(`[WS-BCAST]   → matchVehicle=${matchVehicle} matchTrip=${matchTrip} matchSession=${matchSession}`);

        if (matchVehicle && matchTrip && matchSession) {
          console.log('[WS-BCAST] ✓ Sending to client');
          client.send(JSON.stringify(enrichedPayload));
          sentCount++;
        } else {
          console.log('[WS-BCAST] ✗ Skipped (subscription mismatch)');
        }
      } else {
        console.log(`[WS-BCAST] ✗ Client not OPEN (readyState=${client.readyState})`);
      }
    });

    console.log(`[WS-BCAST] Sent to ${sentCount}/${totalClients} clients`);
  };

  // If route_id exists, enrich with geofence check
  if (payload.route_id) {
    Geofence.findOne({ route_id: payload.route_id }).then((geofence) => {
      let geofenceStatus = null;
      if (geofence) {
        try {
          const pt = turf.point(payload.location.coordinates);
          const poly = turf.polygon(geofence.geometry.coordinates);
          geofenceStatus = turf.booleanPointInPolygon(pt, poly) ? 'WITHIN' : 'OUTSIDE';
        } catch (err) {
          console.error('[broadcastTelemetry] Geofence check error:', err.message);
        }
      }
      sendPayload(geofenceStatus);
    });
  } else {
    // No route_id → still broadcast, geofence_status = null
    sendPayload(null);
  }
}



async function handleReplay(ws, data) {
  const query = {};
  if (data.vehicle_id) query.vehicle_id = data.vehicle_id;
  if (data.trip_id) query.trip_id = data.trip_id;
  if (data.session_id) query.session_id = data.session_id;

  const history = await Telemetry.find(query).sort({ timestamp: 1 });
  if (!history.length) {
    console.warn(' No telemetry found for replay query:', query);
    return ws.send(JSON.stringify({ error: 'No trip history found' }));
  }

  console.log(` Streaming replay for query:`, query);

  for (const point of history) {
    while (ws.replayState.paused) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ws.replayState.active) break;

    let geofenceStatus = null;
    if (point.route_id) {
      const geofence = await Geofence.findOne({ route_id: point.route_id });
      if (geofence) {
        const pt = turf.point(point.location.coordinates);
        const poly = turf.polygon(geofence.geometry.coordinates);
        geofenceStatus = turf.booleanPointInPolygon(pt, poly) ? 'WITHIN' : 'OUTSIDE';
      }
    }

    const payload = {
      type: 'replay',
      vehicle_id: point.vehicle_id,
      trip_id: point.trip_id,
      session_id: point.session_id,
      location: { type: 'Point', coordinates: point.location.coordinates },
      speed: point.speed,
      direction: point.direction,
      state: point.state,
      timestamp: point.timestamp,
      position_name: point.position_name,
      geofence_status: geofenceStatus,
      overspeed_count: point.overspeed_count || 0
    };

    console.log(' Sending replay payload:', payload);
    ws.send(JSON.stringify(payload));

    // Delay adjusted by fast-forward speed
    const delay = 1000 / ws.replayState.speed;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = { startWebSocketServer, broadcastTelemetry };

/* Explanation


Payloads Explained

Live Broadcast Payload
{
  "type": "live",
  "session_id": "uuid-session-123",
  "vehicle_id": "V001",
  "trip_id": "T001",
  "route_id": "R001",
  "coordinates": [77.2090, 28.6139],
  "speed": 65,
  "direction": 142,
  "state": "MOVING",
  "timestamp": "2026-02-28T01:25:00Z",
  "geofence_status": "WITHIN"
}


- session_id: groups points for a continuous trip/session.
- vehicle_id / trip_id / route_id: context.
- coordinates: GeoJSON point for replay.
- speed/direction/state: telemetry attributes.
- geofence_status: computed live using Turf.js.

Replay Payload
{
  "type": "replay",
  "session_id": "uuid-session-123",
  "vehicle_id": "V001",
  "trip_id": "T001",
  "coordinates": [77.2095, 28.6142],
  "speed": 45,
  "direction": 90,
  "state": "MOVING",
  "timestamp": "2026-02-28T01:26:00Z",
  "geofence_status": "OUTSIDE"
}


- Same structure, but streamed sequentially from historical telemetry.
- Simulates trip playback with 1s delay between points.

With this design:
- Geofence checks are integrated into both live broadcasts and replay.
- Payloads are consistent: session_id, vehicle/trip context, telemetry attributes, geofence status.
- Replay logic streams telemetry points by session_id or trip_id, simulating real‑time playback.


Replay Control Logic
Admins can send control messages to the WebSocket server to manage replay:
- Start Replay: { "type": "replay", "session_id": "uuid-session-123" }
- Pause Replay: { "type": "pause" }
- Resume Replay: { "type": "resume" }
- Fast‑Forward Replay: { "type": "fastforward", "speed": 2 } (2× speed)


Payloads Recap
Live Payload
- Sent immediately when enrichmentWorker saves telemetry.
- Contains:
- session_id, vehicle_id, trip_id, route_id
- coordinates, speed, direction, state, timestamp
- geofence_status (WITHIN/OUTSIDE)


Replay Payload
- Sent sequentially from historical telemetry.
- Same structure as live payload.
- Streamed with delay (1s default, adjustable with fast‑forward).
- Replay can be paused/resumed interactively.

*/