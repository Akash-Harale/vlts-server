// /routes/routeRoutes.js
// Date: 22 Jan 2026
// Author: Suresh Gupta

const express = require("express");
const router = express.Router();
const routeController = require("../controllers/routeController");

router.post("/routes", routeController.createRoute);
router.get("/routes", routeController.getAllRoutes);
router.delete("/routes/:id", routeController.deleteRoute);

// GET /api/routes/summary
// GET http://localhost:3005/api/routes/summary

router.get("/routes/summary", routeController.getRoutesSummary);

// GET http://localhost:3005/api/routes/67a0f3dce4b1a2d9f8c67890

router.get("/routes/id/:id", routeController.getRouteById);
router.get("/routes/name/:name", routeController.getRouteByName);

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
router.get("/routes/geocodes", routeController.getCoordinates);

/*
REST API so it not only fetches lat/lon for source and destination addresses from 
OpenStreetMap (Nominatim), but also calculates:
  Straight‑line distance (Haversine formula).
  Estimated travel time 
  (based on average speed assumption, e.g. 60 km/h for highway travel — user can adjust).

  GET /api/routes/sldistance?source=Connaught Place, Delhi&destination=Taj Mahal, Agra

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

// GET /api/routes/sldistance?source=Delhi&destination=Agra
router.get("/routes/sldistance", routeController.getCoordinatesWithSLDistance);

// Actual Route Distance , not Straight Line Distance -- Realistic distance
// GET /api/routes/sldistance?source=Delhi&destination=Agra
/*
JSON Response:

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
  "distance_km": "233.45",
  "estimated_time_minutes": 210,
  "avg_speed_used": 60,
  "route_geometry": {
    "type": "LineString",
    "coordinates": [...]
  },
  "geofence_polygon": {
    "type": "Polygon",
    "coordinates": [...]
  }
}

*/
router.get(
  "/routes/actualdistance",
  routeController.getRouteWithActualDistance,
);

// Multiple Routes with OSRM
router.get("/routes/multi-routes", routeController.getMultipleRoutesFromAddresses);

module.exports = router;
