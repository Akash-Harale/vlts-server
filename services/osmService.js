// /services/osmServices.js
// Date: 22 Jan 2026
// Author: Suresh Gupta
// Purpose: To manage OpenStreetMap services like generate linestring data from OSM, generate geofence data

const axios = require("axios");
const turf = require("@turf/turf");

// Fetch LineString route from OSRM API
async function fetchRoute(source, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${source[0]},${source[1]};${destination[0]},${destination[1]}?overview=full&geometries=geojson`;
  const res = await axios.get(url);
  return res.data.routes[0].geometry; // GeoJSON LineString
}

// Generate geofence polygon buffer around LineString
function generateGeofence(lineString, radiusMeters) {
  const buffered = turf.buffer(lineString, radiusMeters, { units: "meters" });
  return buffered.geometry; // GeoJSON Polygon
}

/*
REST API to fetch source and destination Long/Lat from OSM using Nominatim API
REST API endpoint that takes source address and destination address as user inputs, 
queries OpenStreetMap (via the Nominatim API (nominatim.org in Bing)), and 
returns their latitude/longitude coordinates.

*/
// Function to query Nominatim
async function fetchCoords(address) {
  const url = `https://nominatim.openstreetmap.org/search`;
  const response = await axios.get(url, {
    params: {
      q: address,
      format: "json",
      limit: 1,
    },
    headers: { "User-Agent": "YourAppName/1.0 (your@email.com)" },
  });

  if (response.data.length === 0) {
    throw new Error(`No coordinates found for address: ${address}`);
  }

  return {
    address,
    lat: response.data[0].lat,
    lon: response.data[0].lon,
  };
}

// Calculate Straight Line Distance between source/destination
// Haversine formula to calculate distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (val) => (val * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in km
}

// Fetch route details (distance, duration, geometry) from OSRM  -- Actual Route and its distance
async function fetchRouteDetails(sourceCoords, destCoords) {
  const url = `https://router.project-osrm.org/route/v1/driving/${sourceCoords.lon},${sourceCoords.lat};${destCoords.lon},${destCoords.lat}?overview=full&geometries=geojson`;
  const res = await axios.get(url);

  if (!res.data.routes || res.data.routes.length === 0) {
    throw new Error("No route found between source and destination");
  }

  const route = res.data.routes[0];
  return {
    distanceKm: route.distance / 1000, // meters → km
    durationSec: route.duration, // seconds
    geometry: route.geometry, // GeoJSON LineString
  };
}

//  Distance Matrix using OSRM Table API
async function fetchDistanceMatrix(coordsArray) {
  // coordsArray = [ {lat, lon}, {lat, lon}, ... ]
  const coordString = coordsArray.map((c) => `${c.lon},${c.lat}`).join(";");
  const url = `https://router.project-osrm.org/table/v1/driving/${coordString}?annotations=distance,duration`;

  const res = await axios.get(url);

  if (!res.data.distances || !res.data.durations) {
    throw new Error("No matrix data returned from OSRM");
  }

  return {
    distances: res.data.distances, // 2D array in meters
    durations: res.data.durations, // 2D array in seconds
  };
}

async function getMultipleRoutes(startLng, startLat, endLng, endLat) {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?alternatives=true&overview=full&geometries=geojson`;

  const res = await fetch(url);
  const data = await res.json();

  return data.routes || [];
}

module.exports = {
  getMultipleRoutes,
  fetchCoords,
  fetchRouteDetails,
  generateGeofence,
  haversine,
  fetchDistanceMatrix,
  fetchRoute,
};
