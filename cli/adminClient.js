// /cli/adminClient.js
const WebSocket = require('ws');

// Connect to WebSocket server
const ws = new WebSocket('ws://localhost:3005/ws'); // adjust path if needed

/*
ws.on('open', () => {
  console.log(' Admin connected to WebSocket server');

  //  Commented for full scale gps updates testinmg from Vehicle
  // Request replay after 10 seconds
  setTimeout(() => {
    const payload = {
      type: 'replay',
      registration_number: 'UP32AB1234',
      route_name: 'Delhi to Agra'
    };
    console.log(' Admin sending replay request:', payload);
    ws.send(JSON.stringify(payload));
  }, 50000);
});
*/

ws.on('open', () => {
  console.log(' Admin connected to WebSocket server');
});

ws.on('message', (msg) => {
  try {
    const data = JSON.parse(msg.toString());
    console.log(' Admin received payload:', data);

    if (data.type === 'live') {
      console.log(` LIVE update → ${data.registration_number} at ${data.coordinates} (${data.geofence_status})`);
    } else if (data.type === 'replay') {
      console.log(` REPLAY point → ${data.registration_number} at ${data.coordinates} (${data.geofence_status})`);
    } else if (data.error) {
      console.error(` ERROR from server: ${data.error}`);
    }
  } catch (err) {
    console.error(' Error parsing received message:', err.message);
  }
});

ws.on('error', (err) => {
  console.error(' Admin WebSocket error:', err.message);
});
