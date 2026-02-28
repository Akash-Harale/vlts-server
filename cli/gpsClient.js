
/*
Summary
Vehicle WebSocket client → sends live GPS with registration number + route info.
WebSocket server → validates vehicle, route, geofence → stores history in vehicle_routes_history.
Admin WebSocket client → receives live updates with geofence status for dashboard visualization.
Trip Replay
WebSocket client script → tests both live updates (type: update) and replay (type: replay).
*/

// /cli/gpsClint.js

const WebSocket = require('ws');

// Connect to WebSocket server
const ws = new WebSocket('ws://localhost:3005');

ws.on('open', () => {
  console.log(' Connected to WebSocket server');

  // 1. Send live GPS update (simulate vehicle device)
  ws.send(JSON.stringify({
    type: 'update',
    registration_number: 'UP32AB1234',
    route_name: 'Delhi to Agra',
    coordinates: [77.4126, 28.6692] // [lng, lat]
  }));

  // 2. Request trip replay (simulate Admin dashboard)
  setTimeout(() => {
    ws.send(JSON.stringify({
      type: 'replay',
      registration_number: 'UP32AB1234',
      route_name: 'Delhi to Agra'
    }));
  }, 5000); // wait 5s before requesting replay
});

ws.on('error', (err) => { 
    console.error('WebSocket error:', err.message); });

ws.on('message', (msg) => {
  const data = JSON.parse(msg.toString());
  if (data.type === 'live') {
    console.log(` LIVE: Vehicle ${data.registration_number} is ${data.geofence_status} geofence at ${data.coordinates}`);
  } else if (data.type === 'replay') {
    console.log(` REPLAY: Vehicle ${data.registration_number} at ${data.coordinates} (${data.geofence_status})`);
  } else if (data.error) {
    console.error(` ERROR: ${data.error}`);
  }
});


