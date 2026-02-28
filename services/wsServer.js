// /services/wsServer.js

/*
Summary
- Vehicle WebSocket client → sends live GPS with registration number + route info.
- WebSocket server → validates vehicle, route, geofence → stores history in vehicle_routes_history.
- Admin WebSocket client → receives live updates with geofence status for dashboard visualization.
- Replay support → Admin can request past trip data on demand.

Console logs added for:
- Raw messages received ( Received raw message )
- Payloads being handled ( Handling vehicle update, Handling replay request )
- Stored history ( Stored vehicle history )
- Payloads being broadcast ( Broadcasting live payload, Sending replay payload )
- Warnings when vehicle/route/geofence not found
*/

const WebSocket = require('ws');
const Vehicle = require('../models/vehicle');
const Route = require('../models/route');
const Geofence = require('../models/geofence');
const VehicleRouteHistory = require('../models/vehicleTripsHistory');
const turf = require('@turf/turf');
const Driver = require('../models/driver'); // corrected naming for clarity

/**
 * Start WebSocket server
 * @param {http.Server} server - Node HTTP server instance
 */
function startWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });

  // Fired when a new client (Vehicle or Admin) connects
  wss.on('connection', (ws) => {
    console.log(' WebSocket client connected');

    // Handle incoming messages from clients
    ws.on('message', async (message) => {
      try {
        console.log(' Received raw message:', message.toString());
        const data = JSON.parse(message);

        // Handle live GPS updates from vehicles
        if (data.type === 'update') {
          console.log(' Handling vehicle update payload:', data);
          await handleVehicleUpdate(ws, wss, data);
        }

        // Handle replay requests from Admin clients
        // Uncomment when replay testing is required
        /*
        if (data.type === 'replay') {
          console.log(' Handling replay request payload:', data);
          await handleReplay(ws, data);
        }
        */
      } catch (err) {
        console.error(' WebSocket error:', err.message);
        ws.send(JSON.stringify({ error: 'Invalid message format or server error' }));
      }
    });
  });

  console.log(' WebSocket server started');
}

/**
 * Handle live vehicle GPS updates
 * @param {WebSocket} ws - Client socket
 * @param {WebSocket.Server} wss - WebSocket server
 * @param {Object} data - Incoming payload
 */
async function handleVehicleUpdate(ws, wss, data) {
  /*
  Example payload from VehicleClient (GPS device):
  {
    route_id: "12345",
    vehicle_id: "67890",
    driver_id: "abcde",
    type: "update",
    coordinates: [77.2090, 28.6139] // [lng, lat]
  }
  */

  const { route_id, vehicle_id, driver_id, coordinates } = data;

  // 1. Resolve vehicle
  const vehicle = await Vehicle.findById(vehicle_id); // corrected usage
  if (!vehicle) {
    console.warn(` Vehicle not found: ${vehicle_id}`);
    return ws.send(JSON.stringify({ error: 'Vehicle not found' }));
  }

  // 2. Resolve route + geofence
  const route = route_id
    ? await Route.findById(route_id)
    : await Route.findOne({ name: data.route_name }); // fallback if route_name provided

  const geofence = await Geofence.findOne({ route_id: route?._id });

  if (!route || !geofence) {
    console.warn(` Route or geofence not found for: ${data.route_name || route_id}`);
    return ws.send(JSON.stringify({ error: 'Route or geofence not found' }));
  }

  // 3. Check geofence status using Turf.js
  const pt = turf.point(coordinates);
  const poly = turf.polygon(geofence.geometry.coordinates);
  const geofenceStatus = turf.booleanPointInPolygon(pt, poly) ? 'WITHIN' : 'OUTSIDE';

  // 4. Resolve driver (optional, if driver_id provided)
  const driver = driver_id ? await Driver.findById(driver_id) : null;
  if (!driver) {
    console.warn(` Driver not found: ${driver_id}`);
    return ws.send(JSON.stringify({ error: 'Driver not found' }));
  }

  // 5. Store history in MongoDB
  const history = new VehicleRouteHistory({
    vehicle_id: vehicle._id,
    registration_number: vehicle.registration_number,
    route_id: route._id,
    route_name: route.name,
    driver_id: driver?._id,
    driver_name: driver?.driver_name,
    location: { type: 'Point', coordinates },
    geofence_status: geofenceStatus
  });

  await history.save();
  console.log(' Stored vehicle history:', history.toObject());

  // 6. Broadcast live update to all Admin clients
  const payload = {
    type: 'live',
    route_id,
    route_name: route.name,
    vehicle_id,
    registration_number: vehicle.registration_number,
    driver_id,
    driver_name: driver?.driver_name,
    coordinates,
    geofence_status: geofenceStatus,
    timestamp: history.timestamp
  };

  console.log(' Broadcasting live payload to admins:', payload);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  });
}

/**
 * Handle on-demand trip replay requests (Admin only)
 * Uncomment when replay feature is needed
 */
/*
async function handleReplay(ws, data) {
  const { vehicle_id, registration_number, route_id, route_name } = data;

  // Build query dynamically based on provided identifiers
  const query = {};
  if (vehicle_id) query.vehicle_id = vehicle_id;
  if (registration_number) query.registration_number = registration_number;
  if (route_id) query.route_id = route_id;
  if (route_name) query.route_name = route_name;

  const history = await VehicleRouteHistory.find(query).sort({ timestamp: 1 });

  if (!history.length) {
    console.warn(` No trip history found for query:`, query);
    return ws.send(JSON.stringify({ error: 'No trip history found' }));
  }

  console.log(` Streaming replay for ${registration_number || vehicle_id} on route ${route_name || route_id}`);

  // Stream history points one by one to simulate replay
  for (const point of history) {
    const payload = {
      type: 'replay',
      registration_number: point.registration_number,
      route_name: point.route_name,
      coordinates: point.location.coordinates,
      geofence_status: point.geofence_status,
      timestamp: point.timestamp
    };

    console.log(' Sending replay payload:', payload);
    ws.send(JSON.stringify(payload));
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay between points
  }
}
*/

module.exports = startWebSocketServer;
