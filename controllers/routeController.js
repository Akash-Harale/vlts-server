// /controllers/routeController,js
// Date: 22 Jan 2026
// Author: Suresh Gupta

const Route = require("../models/route");
const Geofence = require("../models/geofence");
const {
  fetchRoute,
  generateGeofence,
  fetchCoords,
  fetchRouteDetails,
  haversine,
  getMultipleRoutes,
  getRouteWithWaypoints,
} = require("../services/osmService");

// Create route + geofence
exports.createRoute = async (req, res) => {
  try {
    const { name, source, destination, geofence_radius } = req.body;

    // Fetch LineString from OSM
    const lineString = await fetchRoute(source, destination);

    // Save Route
    const route = new Route({
      name,
      source,
      destination,
      geometry: lineString,
    });
    await route.save();

    // Generate Geofence Polygon
    const polygon = generateGeofence(lineString, geofence_radius);

    const geofence = new Geofence({
      route_id: route._id,
      radius: geofence_radius,
      geometry: polygon,
    });
    await geofence.save();

    res.status(201).json({ route, geofence });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.deleteRoute = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Check if route exists
    const route = await Route.findById(id);
    if (!route) {
      return res.status(404).json({
        success: false,
        message: "Route not found",
      });
    }

    // 2. Delete related geofences
    await Geofence.deleteMany({ route_id: id });

    // 3. Delete route
    await Route.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Route and related geofences deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Fetch all routes with LineString data -- detailed API
exports.getAllRoutes = async (req, res) => {
  try {
    const routes = await Route.find();
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch all routes at summary level
/* JSON Response like:
[
  {
    "_id": "67a0f3dce4b1a2d9f8c67890",
    "name": "Delhi to Agra",
    "source": [77.2090, 28.6139],
    "destination": [78.0081, 27.1767],
    "created_at": "2026-01-22T11:02:00.000Z"
  },
  {
    "_id": "67a0f3dce4b1a2d9f8c67891",
    "name": "Agra to Jaipur",
    "source": [78.0081, 27.1767],
    "destination": [75.7873, 26.9124],
    "created_at": "2026-01-22T11:05:00.000Z"
  }
]

*/

exports.getRoutesSummary = async (req, res) => {
  console.log("getRoutesSummary called....");
  try {
    const routes = await Route.find(
      {},
      {
        _id: 1,
        name: 1,
        source: 1,
        destination: 1,
        created_at: 1,
      },
    );

    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch route by route_id
// GET http://localhost:3005/api/routes/67a0f3dce4b1a2d9f8c67890

exports.getRouteById = async (req, res) => {
  try {
    const { route_id } = req.params;

    const route = await Route.findById(route_id);
    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }

    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch route by name
//GET http://localhost:3005/api/routes/name/Delhi to Agra

exports.getRouteByName = async (req, res) => {
  try {
    const { route_name } = req.params;

    const route = await Route.findById(route_name);

    if (!route) return res.status(404).json({ error: "Route not found" });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/*
REST API to fetch source and destination Long/Lat from OSM using Nominatim API
REST API endpoint that takes source address and destination address as user inputs, 
queries OpenStreetMap (via the Nominatim API (nominatim.org in Bing)), and 
returns their latitude/longitude coordinates.

GET /api/geocode?source=Delhi&destination=Agra 
JSON RESPONSE:

{
    "source": {
        "address": "Delhi",
        "lat": "28.6138954",
        "lon": "77.2090057"
    },
    "destination": {
        "address": "Agra",
        "lat": "27.1752554",
        "lon": "78.0098161"
    }
}
*/

exports.getCoordinates = async (req, res) => {
  console.log("inside getCoordinates");
  try {
    const { source, destination } = req.query;
    console.log(source, destination);

    if (!source || !destination) {
      return res
        .status(400)
        .json({ error: "Source and destination addresses are required" });
    }

    const sourceCoords = await fetchCoords(source);
    const destinationCoords = await fetchCoords(destination);
    console.log(sourceCoords, destinationCoords);

    res.json({
      source: sourceCoords,
      destination: destinationCoords,
    });
  } catch (err) {
    console.error("Error fetching coordinates:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/*
REST API so it not only fetches lat/lon for source and destination addresses from 
OpenStreetMap (Nominatim), but also calculates:
  Straight‑line distance (Haversine formula).
  Estimated travel time
  (based on average speed assumption, e.g. 60 km/h for highway travel — user can adjust).

  GET /api/geocode?source=Connaught Place, Delhi&destination=Taj Mahal, Agra

  JSON RESPONSE:

  {
  "source": {
    "address": "Connaught Place, Delhi",
    "lat": 28.6315,
    "lon": 77.2167
  },
  "destination": {
    "address": "Taj Mahal, Agra",
    "lat": 27.1751,
    "lon": 78.0421
  },
  "distance_km": "181.45",
  "estimated_time_minutes": 181
}

*/
// SL = Straight Line
exports.getCoordinatesWithSLDistance = async (req, res) => {
  console.log("routeController: getCoordinatesWithSLDistance: ", req.query);
  try {
    const { source, destination, avgspeed } = req.query;

    if (!source || !destination) {
      return res
        .status(400)
        .json({ error: "Source and destination addresses are required" });
    }

    const sourceCoords = await fetchCoords(source);
    const destinationCoords = await fetchCoords(destination);

    // Calculate distance
    const distanceKm = haversine(
      sourceCoords.lat,
      sourceCoords.lon,
      destinationCoords.lat,
      destinationCoords.lon,
    );

    // Estimate travel time (assuming avg speed 60 km/h)
    //const avgspeed = 60;
    const timeHours = distanceKm / avgspeed;
    const timeMinutes = Math.round(timeHours * 60);

    res.json({
      source: sourceCoords,
      destination: destinationCoords,
      distance_km: distanceKm.toFixed(2),
      estimated_time_hours: timeHours.toFixed(2),
    });
  } catch (err) {
    console.error("Error fetching coordinates:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// Fetch actual route distance , fall back straight line distance
/*
single end‑to‑end API that:
Accepts source address, destination address, and avgSpeed (user input).
Uses OpenStreetMap Nominatim to geocode addresses → lat/lon.
Calls OSRM Routing API to get actual driving distance and duration.
If OSRM duration is available, return it. Otherwise, fall back to calculating time using distance / avgSpeed.

*/

exports.getRouteWithActualDistance = async (req, res) => {
  try {
    const { source, destination, avgSpeed } = req.query;

    if (!source || !destination) {
      return res
        .status(400)
        .json({ error: "Source and destination addresses are required" });
    }

    const speed = avgSpeed ? parseFloat(avgSpeed) : 60; // default km/h

    // Step 1: Geocode both addresses
    const sourceCoords = await fetchCoords(source);
    const destCoords = await fetchCoords(destination);

    // Step 2: Get route details from OSRM
    const { distanceKm, durationSec, geometry } = await fetchRouteDetails(
      sourceCoords,
      destCoords,
    );

    // Step 3: Calculate time
    let timeHours;
    let timeMinutes;
    if (durationSec) {
      timeMinutes = Math.round(durationSec / 60);
      timeHours = timeMinutes / 60;
    } else {
      timeHours = distanceKm / speed;
      timeMinutes = Math.round(timeHours * 60);
    }
    /*  To be used later
    // Step 4: Optional geofence
    const geofence = generateGeofence(geometry, 500); // 500m buffer

    res.json({
      source: sourceCoords,
      destination: destCoords,
      distance_km: distanceKm.toFixed(2),
      estimated_time_minutes: timeMinutes,
      avg_speed_used: speed,
      route_geometry: geometry,
      geofence_polygon: geofence
    });
    */
    // Removed geometry and geofence data

    res.json({
      source: sourceCoords,
      destination: destCoords,
      distance_km: distanceKm.toFixed(2),
      estimated_time_hours: timeHours.toFixed(2),
      avg_speed_used: speed,
    });
  } catch (err) {
    console.error("Error fetching route:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/*
REST API to fetch multiple routes between source and destination addresses.
GET /api/routes/multi-routes?source=Delhi&destination=Agra
*/
// Multiple Routes with OSRM (direct — no intermediate stops)
exports.getMultipleRoutesFromAddresses = async (req, res) => {
  try {
    const { source, destination } = req.query;

    if (!source || !destination) {
      return res
        .status(400)
        .json({ error: "Source and destination addresses are required" });
    }

    // Step 1: Geocode both addresses
    const sourceCoords = await fetchCoords(source);
    const destCoords = await fetchCoords(destination);

    // Step 2: Get multiple routes from OSRM
    const { routes, waypoints } = await getMultipleRoutes(
      sourceCoords.lon,
      sourceCoords.lat,
      destCoords.lon,
      destCoords.lat
    );

    res.json({ routes, waypoints });
  } catch (err) {
    console.error("Error fetching multiple routes:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/*
  GET /api/routes/multi-routes-with-stops
  ?source=Nagpur&destination=Pune&stops=Wardha,Yavatmal

  Geocodes source, each comma-separated stop, and destination in parallel,
  then fetches OSRM route(s) chained through all waypoints in order.

  Returns the same OSRM route array shape as multi-routes but the geometry
  passes through every intermediate stop.
*/
exports.getMultipleRoutesWithWaypoints = async (req, res) => {
  try {
    const { source, destination, stops } = req.query;

    if (!source || !destination) {
      return res
        .status(400)
        .json({ error: "Source and destination addresses are required" });
    }

    // Parse stops — may be a comma-delimited string or absent
    const stopNames = stops
      ? stops.split("|").map((s) => s.trim()).filter(Boolean)
      : [];

    // Geocode source, all stops, and destination in parallel
    const allPlaceNames = [source, ...stopNames, destination];
    const allCoords = await Promise.all(allPlaceNames.map(fetchCoords));

    // Fetch route through all waypoints
    const { routes, waypoints } = await getRouteWithWaypoints(allCoords);

    // Attach human-readable labels to each route
    const labelledRoutes = routes.map((route) => ({
      ...route,
      waypoint_labels: allPlaceNames,
    }));

    res.json({ routes: labelledRoutes, waypoints });
  } catch (err) {
    console.error("Error fetching routes with waypoints:", err.message);
    res.status(500).json({ error: err.message });
  }
};
