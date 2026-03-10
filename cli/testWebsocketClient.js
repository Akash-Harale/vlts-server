// testWebsocketClient.js
/*
How to Test
- Start MongoDB.
- Run TCP server (node services/tcpServer.js).
- Run enrichment worker (node services/enrichmentWorker.js).
- Run WebSocket server (node services/websocketServer.js).
- Connect a WebSocket client (browser or Node):

Testing Workflow
- Start MongoDB → mongod
- Run TCP server → node services/tcpServer.js
- Run enrichment worker → node workers/enrichmentWorker.js
- Run Express + WebSocket server → node server.js
- Open dashboard → http://localhost:8080/index.html (if served via http-server)
- Simulate telemetry:
- Send raw GPS packets to TCP server (use netcat or a simulator).
- Watch enrichment worker process them.
- See WebSocket broadcast update dashboard.
- Verify alerts:
- Overspeed (>80 km/h) → red alert.
- Geofence exit → yellow alert.
- Export daily summary → click CSV/JSON buttons, open file to confirm metrics.

This gives you a reproducible pipeline:
TCP ingest → Enrichment → WebSocket broadcast → Express API → Dashboard visualization.
Would you like me to also draft a sample telemetry simulator script (e.g., simulator.js) that pushes random GPS points into the TCP server so you can test the full pipeline without real devices?

*/

/*
// testWebsocketClient.js
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3005');

ws.on('open', () => {
  console.log('[Client] Connected to WebSocket server');

  // Subscribe without filters first to verify broadcast
  const subscriptionMsg = { type: 'subscribe' };
  ws.send(JSON.stringify(subscriptionMsg));
  console.log('[Client] Sent subscription:', subscriptionMsg);

  // Later you can filter by vehicle/trip/session once you confirm data flows
});

ws.on('message', (msg) => {
  console.log('[Client] Raw message:\n', msg.toString());
  try {
    const data = JSON.parse(msg);

    if (data.type === 'live') {
      console.log(`\n[Live] Vehicle ${data.vehicle_id} @ ${data.location.coordinates} speed=${data.speed} km/h geofence=${data.geofence_status}`);
      if (data.speed > 80) {
        console.warn(`[Alert] Overspeed detected: ${data.speed} km/h`);
      }
    } else if (data.type === 'replay') {
      console.log(`\n[Replay] Vehicle ${data.vehicle_id} @ ${data.coordinates} speed=${data.speed} km/h geofence=${data.geofence_status}`);
    } else if (data.error) {
      console.error('[Error from server]', data.error);
    }
  } catch (err) {
    console.error('[Client] Failed to parse message:', err.message);
  }
});

ws.on('close', () => console.log('[Client] Connection closed'));
ws.on('error', (err) => console.error('[Client] WebSocket error:', err.message));
    
*/

// testWebsocketClient.js
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3005');

// Utility to print telemetry in a readable block
function printTelemetry(title, fields) {
    console.log('\n========== ' + title + ' ==========');
    for (const [key, value] of Object.entries(fields)) {
        console.log(`${key.padEnd(12)}: ${value}`);
    }
    console.log('=====================================\n');
}

ws.on('open', () => {
    console.log('[Client] Connected to WebSocket server');

    // --- Choose your subscription filter ---
    // Option 1: Subscribe by vehicle only
    const subscriptionMsg = {
        type: 'subscribe',
        vehicle_id: '69a6d437e348c3bcbdc46877'
    };

    // Option 2: Subscribe by vehicle + trip
    // const subscriptionMsg = {
    //   type: 'subscribe',
    //   vehicle_id: 'YOUR_VEHICLE_ID_HERE',
    //   trip_id: 'YOUR_TRIP_ID_HERE'
    // };

    ws.send(JSON.stringify(subscriptionMsg));
    console.log('[Client] Sent subscription:', subscriptionMsg);
});

ws.on('message', (msg) => {
    try {
        const data = JSON.parse(msg);

        if (data.type === 'live') {
            printTelemetry(' Live Telemetry', {
                'Vehicle ID': data.vehicle_id,
                'Trip ID': data.trip_id || 'N/A',
                'Session ID': data.session_id,
                'Coordinates': data.location.coordinates.join(', '),
                'Speed': `${data.speed} km/h`,
                'Direction': data.direction,
                'State': data.state,
                'Timestamp': data.timestamp,
                'Geofence': data.geofence_status || 'N/A'
            });

            if (data.speed > 80) {
                console.log(' Overspeed Alert:', data.speed, 'km/h');
            }
            if (data.geofence_status === 'OUTSIDE') {
                console.log(' Geofence Alert: Vehicle exited geofence');
            }
        } else if (data.type === 'replay') {
            printTelemetry(' Replay Telemetry', {
                'Vehicle ID': data.vehicle_id,
                'Trip ID': data.trip_id || 'N/A',
                'Session ID': data.session_id,
                'Coordinates': data.coordinates.join(', '),
                'Speed': `${data.speed} km/h`,
                'Direction': data.direction,
                'State': data.state,
                'Timestamp': data.timestamp,
                'Geofence': data.geofence_status || 'N/A'
            });
        } else if (data.error) {
            console.error('[Error from server]', data.error);
        }
    } catch (err) {
        console.error('[Client] Failed to parse message:', err.message);
    }
});

ws.on('close', () => console.log('[Client] Connection closed'));
ws.on('error', (err) => console.error('[Client] WebSocket error:', err.message));
