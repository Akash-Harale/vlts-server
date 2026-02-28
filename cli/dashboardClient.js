
/*
Summary
Vehicle WebSocket client → sends live GPS with registration number + route info.
WebSocket server → validates vehicle, route, geofence → stores history in vehicle_routes_history.
Admin WebSocket client → receives live updates with geofence status for dashboard visualization.
*/

const ws = new WebSocket('ws://localhost:3005');

ws.onopen = () => console.log('Admin connected to WebSocket');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`Vehicle ${data.registration_number} is ${data.geofence_status} geofence at ${data.coordinates}`);
  // Update dashboard map with live marker + geofence status
};

