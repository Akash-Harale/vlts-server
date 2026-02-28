// ./controllers/tripHistoryController.js
// Date: 26 Feb 2026
// Author: Suresh Gupta
// Purpose: Handles summary-level trip history queries

const { validationResult } = require("express-validator");
const TripHistory = require("../models/tripHistory");
const RouteHistory = require("../models/routeHistory");
const Vehicle = require("../models/vehicle");
const Driver = require("../models/driver");
const { audit, error } = require("../utils/logger");

console.log("[tripHistoryController] Controller loaded.");

/**
 * Utility: handle validation errors
 */
function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    console.error("[ValidationError]", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }
}

/**
 * Get trip summary by trip ID
 */
exports.getTripById = async (req, res) => {
  if (handleValidationErrors(req, res)) return;

  try {
    const tripId = req.params.tripId;
    console.log(`[getTripById] Fetching trip summary for tripId=${tripId}`);

    const trip = await TripHistory.findById(tripId);
    if (!trip) {
      console.warn(`[getTripById] Trip not found: ${tripId}`);
      await audit("system", "api", "getTripById", "Trip", `Trip ${tripId} not found`, "failed");
      return res.status(404).json({ message: "Trip not found" });
    }

    const route = await RouteHistory.findOne({ trip_id: trip._id });
    const vehicle = trip.vehicle_id ? await Vehicle.findById(trip.vehicle_id) : null;
    const driver = trip.driver_id ? await Driver.findById(trip.driver_id) : null;

    console.log(`[getTripById] Trip summary fetched successfully for tripId=${tripId}`);
    await audit("system", "api", "getTripById", "Trip", `Trip ${tripId} summary fetched`, "success");
    res.json({ trip, route, vehicle, driver });
  } catch (err) {
    console.error("[getTripById] Error:", err);
    await error("system", "api", err, "TripById");
    res.status(500).json({ message: "Error fetching trip summary", error: err.message });
  }
};

/**
 * Get trips by vehicle ID
 */
exports.getTripsByVehicle = async (req, res) => {
  if (handleValidationErrors(req, res)) return;

  try {
    const vehicleId = req.params.vehicleId;
    console.log(`[getTripsByVehicle] Fetching trips for vehicleId=${vehicleId}`);

    const trips = await TripHistory.find({ vehicle_id: vehicleId }).sort({ departure_time: -1 });
    const vehicle = await Vehicle.findById(vehicleId);

    const enrichedTrips = await Promise.all(trips.map(async trip => {
      const driver = trip.driver_id ? await Driver.findById(trip.driver_id) : null;
      return { trip, driver };
    }));

    console.log(`[getTripsByVehicle] Found ${trips.length} trips for vehicleId=${vehicleId}`);
    await audit("system", "api", "getTripsByVehicle", "Trip", `Trips fetched for vehicle ${vehicleId}`, "success");
    res.json({ vehicle, trips: enrichedTrips });
  } catch (err) {
    console.error("[getTripsByVehicle] Error:", err);
    await error("system", "api", err, "TripsByVehicle");
    res.status(500).json({ message: "Error fetching trips by vehicle", error: err.message });
  }
};

/**
 * Get trips by driver ID
 */
exports.getTripsByDriver = async (req, res) => {
  if (handleValidationErrors(req, res)) return;

  try {
    const driverId = req.params.driverId;
    console.log(`[getTripsByDriver] Fetching trips for driverId=${driverId}`);

    const trips = await TripHistory.find({ driver_id: driverId }).sort({ departure_time: -1 });
    const driver = await Driver.findById(driverId);

    const enrichedTrips = await Promise.all(trips.map(async trip => {
      const vehicle = trip.vehicle_id ? await Vehicle.findById(trip.vehicle_id) : null;
      return { trip, vehicle };
    }));

    console.log(`[getTripsByDriver] Found ${trips.length} trips for driverId=${driverId}`);
    await audit("system", "api", "getTripsByDriver", "Trip", `Trips fetched for driver ${driverId}`, "success");
    res.json({ driver, trips: enrichedTrips });
  } catch (err) {
    console.error("[getTripsByDriver] Error:", err);
    await error("system", "api", err, "TripsByDriver");
    res.status(500).json({ message: "Error fetching trips by driver", error: err.message });
  }
};

/**
 * Get all trips
 */
exports.getAllTrips = async (req, res) => {
  try {
    console.log("[getAllTrips] Fetching all trips");

    const trips = await TripHistory.find().sort({ departure_time: -1 });

    const enrichedTrips = await Promise.all(trips.map(async trip => {
      const vehicle = trip.vehicle_id ? await Vehicle.findById(trip.vehicle_id) : null;
      const driver = trip.driver_id ? await Driver.findById(trip.driver_id) : null;
      return { trip, vehicle, driver };
    }));

    console.log(`[getAllTrips] Found ${trips.length} trips`);
    await audit("system", "api", "getAllTrips", "Trip", "All trips fetched", "success");
    res.json(enrichedTrips);
  } catch (err) {
    console.error("[getAllTrips] Error:", err);
    await error("system", "api", err, "AllTrips");
    res.status(500).json({ message: "Error fetching all trips", error: err.message });
  }
};

/**
 * Get trips by date range
 */
exports.getTripsByDateRange = async (req, res) => {
  console.log('getTripsByDateRange: req.query:', req.query);

  if (handleValidationErrors(req, res)) return;

  try {
    const { startDate, endDate } = req.query;
    console.log(`[getTripsByDateRange] Fetching trips between ${startDate} and ${endDate}`);

    const trips = await TripHistory.find({
      departure_time: { $gte: new Date(startDate), $lte: new Date(endDate) }
    }).sort({ departure_time: -1 });

    const enrichedTrips = await Promise.all(trips.map(async trip => {
      const vehicle = trip.vehicle_id ? await Vehicle.findById(trip.vehicle_id) : null;
      const driver = trip.driver_id ? await Driver.findById(trip.driver_id) : null;
      return { trip, vehicle, driver };
    }));

    console.log(`[getTripsByDateRange] Found ${trips.length} trips between ${startDate} and ${endDate}`);
    await audit("system", "api", "getTripsByDateRange", "Trip", `Trips fetched between ${startDate} and ${endDate}`, "success");
    res.json(enrichedTrips);
  } catch (err) {
    console.error("[getTripsByDateRange] Error:", err);
    await error("system", "api", err, "TripsByDateRange");
    res.status(500).json({ message: "Error fetching trips by date range", error: err.message });
  }
};




// Fetch trip by route_id
// Controller to fetch geometry for a given tripId
exports.fetchRouteGeometry = async (req, res) => {
  const tripId = req.params.tripId;
  console.log("[tripHistoryController] getRouteGeometry called with tripId:", tripId);

  try {
    // Fetch trip and populate route, vehicle, driver
    const trip = await TripHistory.findById(tripId)
      .populate({
        path: "route_id",
        select: "geometry name place_from place_to source destination"
      })
      .populate({
        path: "vehicle_id", 
        select: "registration_number make model"
      })
      .populate({
        path: "driver_id", 
        select: "driver_name mobile_number"
      })
      .lean();

    if (!trip) {
      console.error("[tripHistoryController] Trip not found for ID:", tripId);
      return res.status(404).json({
        success: false,
        message: "Trip not found"
      });
    }

    if (!trip.route_id || !trip.route_id.geometry) {
      console.error("[tripController] Geometry not available for route:", trip.route_id?._id);
      return res.status(404).json({
        success: false,
        message: "Geometry not available for this route"
      });
    }

    console.log("[tripHistoryController] Geometry successfully retrieved for route:", trip.route_id._id);

    return res.status(200).json({
      success: true,
      data: {
        tripId: trip._id,
        route: {
          id: trip.route_id._id,
          name: trip.route_id.name,
          from: trip.route_id.place_from,
          to: trip.route_id.place_to,
          source: trip.route_id.source,
          destination: trip.route_id.destination,
          geometry: trip.route_id.geometry
        },
        vehicle: trip.vehicle_id
          ? {
              id: trip.vehicle_id._id,
              registrationNumber: trip.vehicle_id.registration_number,
              make: trip.vehicle_id.make,
              model: trip.vehicle_id.model
            }
          : null,
        driver: trip.driver_id
          ? {
              id: trip.driver_id._id,
              name: trip.driver_id.driver_name,
              mobileNumber: trip.driver_id.mobile_number
            }
          : null
      }
    });
  } catch (err) {
    console.error("[tripHistoryController] Error while fetching geometry:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
