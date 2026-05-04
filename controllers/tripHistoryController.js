// ./controllers/tripHistoryController.js
// Date: 26 Feb 2026
// Author: Suresh Gupta
// Purpose: Handles summary-level trip history queries

const { validationResult } = require("express-validator");
const TripHistory = require("../models/tripHistory");
const RouteHistory = require("../models/routeHistory");
const Vehicle = require("../models/vehicle");
const Driver = require("../models/driver");
const logger = require("../utils/logger");

console.log("[tripHistoryController] Controller loaded.");

/**
 * Utility: handle validation errors
 */
function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("[ValidationError]", errors.array());
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}


/**
 * Get all completed trips (optionally filter by date range)
 */
exports.getAllTrips = async (req, res) => {
  console.log("tripController: fetchTrips API: req.query: ", req.query);

  try {
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    console.log("[getAllTrips] Fetching completed trips", { startDate, endDate });

    const filter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      filter.departure_time = { $gte: start, $lte: end };
    }

    const total = await TripHistory.countDocuments(filter);

    const assignments = await TripHistory.find(filter)
      .populate("route_id", "name place_from place_to source destination")
      .populate("vehicle_id", "registration_number make model")
      .populate("driver_id", "driver_name mobile_number email_id")
      .sort({ departure_time: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const data = assignments.map(a => ({
      trip_id: a._id,
      vehicle_id: a.vehicle_id,
      registration_number: a.registration_number,
      make: a.make,
      model: a.model,
      route_id: a.route_id,
      route_name: a.name,
      driver_id: a.driver_id,
      driver_name: a.driver_name,
      mobile_number: a.mobile_number,
      departure_time: a.departure_time ?? null,
      arrival_time: a.arrival_time ?? null,
      assignment_desc: a.assignment_desc,
      assigned_at: a.assigned_at,
      status: a.status,
      trip_approval_status: a.trip_approval_status,
      trip_dep_status: a.trip_dep_status,
      trip_arrival_status: a.trip_arrival_status,
      trip_actual_arrival_time: a.trip_actual_arrival_time ?? null,
      max_speed: a.max_speed || 0,
      avg_speed: a.avg_speed || 0,
      total_distance: a.total_distance || 0,
      position_name: a.position_name || null,
      __v: a.__v
    }));

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'tripHistory',
      `All completed trips fetched, page: ${page}, count: ${data.length}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json({
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
      data
    });

  } catch (err) {
    console.error("Error fetching routes with mapped vehicles:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'tripHistory',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ error: err.message });
  }
};


/**
 * Get completed trip by ID
 */
exports.getTripById = async (req, res) => {
  if (handleValidationErrors(req, res)) return;

  try {
    const tripId = req.params.tripId;
    console.log(`[getTripById] Fetching completed trip summary for tripId=${tripId}`);

    const trip = await TripHistory.findById(tripId).lean();
    if (!trip) {
      await logger.audit(
        req.user?.employee_id || 'SYSTEM',
        req.user?.employee_id?.name || 'SYSTEM',
        req.user?.role || 'unknown',
        'read',
        'tripHistory',
        `Trip ${tripId} not found`,
        'failed',
        req.user?.tenant_id || null,
        req.trace_id
      );
      return res.status(404).json({ message: "Trip not found" });
    }

    const vehicle = trip.vehicle_id ? await Vehicle.findById(trip.vehicle_id).lean() : null;
    const driver = trip.driver_id ? await Driver.findById(trip.driver_id).lean() : null;

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'tripHistory',
      `Trip ${tripId} summary fetched`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json({ trip, vehicle, driver });
  } catch (err) {
    console.error("[getTripById] error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'tripHistory',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ message: "Error fetching trip summary", error: err.message });
  }
};


/**
 * Get completed trips by vehicle ID
 */
exports.getTripsByVehicle = async (req, res) => {
  console.log("[getTripsByVehicle] Fetching completed trips by VehicleId: ", req.params.vehicleId);
  if (handleValidationErrors(req, res)) return;

  try {
    const vehicleId = req.params.vehicleId;
    console.log(`[getTripsByVehicle] Fetching completed trips for vehicleId=${vehicleId}`);

    const trips = await TripHistory.find({ vehicle_id: vehicleId }).sort({ departure_time: -1 }).lean();
    const vehicle = await Vehicle.findById(vehicleId).lean();

    const enrichedTrips = await Promise.all(trips.map(async trip => {
      const driver = trip.driver_id ? await Driver.findById(trip.driver_id).lean() : null;
      return { trip, driver };
    }));

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'tripHistory',
      `Trips fetched for vehicle ${vehicleId}, count: ${enrichedTrips.length}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json({ vehicle, trips: enrichedTrips });
  } catch (err) {
    console.error("[getTripsByVehicle] error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'tripHistory',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ message: "Error fetching trips by vehicle", error: err.message });
  }
};


/**
 * Get completed trips by driver ID
 */
exports.getTripsByDriver = async (req, res) => {
  console.log("[getTripsByDriver] Fetching completed trips by driverId: ", req.params.driverId);
  if (handleValidationErrors(req, res)) return;

  try {
    const driverId = req.params.driverId;
    console.log(`[getTripsByDriver] Fetching completed trips for driverId=${driverId}`);

    const trips = await TripHistory.find({ driver_id: driverId }).sort({ departure_time: -1 }).lean();
    const driver = await Driver.findById(driverId).lean();

    const enrichedTrips = await Promise.all(trips.map(async trip => {
      const vehicle = trip.vehicle_id ? await Vehicle.findById(trip.vehicle_id).lean() : null;
      return { trip, vehicle };
    }));

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'tripHistory',
      `Trips fetched for driver ${driverId}, count: ${enrichedTrips.length}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json({ driver, trips: enrichedTrips });
  } catch (err) {
    console.error("[getTripsByDriver] error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'tripHistory',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ message: "Error fetching trips by driver", error: err.message });
  }
};


/**
 * Get route geometry for a completed trip
 */
exports.fetchRouteGeometry = async (req, res) => {
  if (handleValidationErrors(req, res)) return;

  const tripId = req.params.tripId;
  console.log("[tripController] fetchRouteGeometry called with tripId:", tripId);

  try {
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
      .select("+trip_arrival_status +trip_actual_arrival_time +trip_arrival_notes")
      .lean();

    if (!trip) {
      console.error("[tripController] Trip not found for ID:", tripId);
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

    console.log("[tripController] Geometry successfully retrieved for route:", trip.route_id._id);

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'routeGeometry',
      `Route geometry fetched for completed trip ${tripId}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

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
          : null,
        arrival: {
          status: trip.trip_arrival_status || "N/A",
          time: trip.trip_actual_arrival_time || null,
          notes: trip.trip_arrival_notes || ""
        },
        stats: {
          max_speed: trip.max_speed || 0,
          avg_speed: trip.avg_speed || 0,
          total_distance: trip.total_distance || 0,
          position_name: trip.position_name || null
        }
      }
    });
  } catch (err) {
    console.error("[tripController] Error while fetching geometry:", err.message);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'routeGeometry',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};









// // ./controllers/tripHistoryController.js
// // Date: 26 Feb 2026
// // Author: Suresh Gupta
// // Purpose: Handles summary-level trip history queries

// const { validationResult } = require("express-validator");
// const TripHistory = require("../models/tripHistory");
// const RouteHistory = require("../models/routeHistory");
// const Vehicle = require("../models/vehicle");
// const Driver = require("../models/driver");
// const { audit, error } = require("../utils/logger");

// console.log("[tripHistoryController] Controller loaded.");

// /**
//  * Utility: handle validation errors
//  */
// function handleValidationErrors(req, res) {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     console.error("[ValidationError]", errors.array());
//     res.status(400).json({ errors: errors.array() });
//     return true; // signal error handled
//   }
//   return false;
// }


// /**
//  * Get all completed trips (optionally filter by date range)
//  */

// exports.getAllTrips = async (req, res) => {

//   console.log("tripController: fetchTrips API: req.query: ", req.query);

//   try {
//     const { page = 1, limit = 10 } = req.query;

//     const { startDate, endDate } = req.query;
//     console.log("[getAllTrips] Fetching completed trips", { startDate, endDate });

//     const filter = {};
//     if (startDate && endDate) {
//       const start = new Date(startDate);
//       const end = new Date(endDate);

//       if (isNaN(start.getTime()) || isNaN(end.getTime())) {
//         return res.status(400).json({ error: "Invalid date format" });
//       }
//       filter.departure_time = { $gte: new Date(startDate), $lte: new Date(endDate) };
//     }

//     const trips = await TripHistory.find(filter).sort({ departure_time: -1 }).lean();


//     // Get total count first 
//     const total = await TripHistory.countDocuments(filter);

//     // Fetch paginated results
//     const assignments = await TripHistory.find(filter)
//       .populate("route_id", "name place_from place_to source destination")
//       .populate("vehicle_id", "registration_number make model")
//       .populate("driver_id", "driver_name mobile_number email_id")
//       .sort({ departure_time: -1 })
//       .skip((page - 1) * limit)
//       .limit(parseInt(limit))
//       .lean(); // plain JS objects

//     const data = assignments.map(a => ({
//       trip_id: a._id,
//       vehicle_id: a.vehicle_id,
//       registration_number: a.registration_number,
//       make: a.make,
//       model: a.model,
//       route_id: a.route_id,
//       route_name: a.name,
//       driver_id: a.driver_id,
//       driver_name: a.driver_name,
//       mobile_number: a.mobile_number,
//       departure_time: a.departure_time ?? null,
//       arrival_time: a.arrival_time ?? null,
//       assignment_desc: a.assignment_desc,
//       assigned_at: a.assigned_at,
//       status: a.status,
//       trip_approval_status: a.trip_approval_status,
//       trip_dep_status: a.trip_dep_status,
//       trip_arrival_status: a.trip_arrival_status,
//       trip_actual_arrival_time: a.trip_actual_arrival_time ?? null,
//       max_speed: a.max_speed || 0,
//       avg_speed: a.avg_speed || 0,
//       total_distance: a.total_distance || 0,
//       position_name: a.position_name || null,
//       __v: a.__v
//     }));

//     res.json({
//       page: parseInt(page),
//       limit: parseInt(limit),
//       total,
//       totalPages: Math.ceil(total / limit),
//       data
//     });

//   } catch (err) {
//     console.error("Error fetching routes with mapped vehicles:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// /*
// exports.getAllTrips = async (req, res) => {
//   try {
//     const { startDate, endDate } = req.query;
//     console.log("[getAllTrips] Fetching completed trips", { startDate, endDate });

//     const filter = {};
//     if (startDate && endDate) {
//         const start = new Date(startDate);
//         const end = new Date(endDate);

//         if (isNaN(start.getTime()) || isNaN(end.getTime())) {
//           return res.status(400).json({ error: "Invalid date format" });
//         }
//       filter.departure_time = { $gte: new Date(startDate), $lte: new Date(endDate) };
//     }

//     const trips = await TripHistory.find(filter).sort({ departure_time: -1 }).lean();

//     const enrichedTrips = await Promise.all(trips.map(async trip => {
//       const vehicle = trip.vehicle_id ? await Vehicle.findById(trip.vehicle_id).lean() : null;
//       const driver = trip.driver_id ? await Driver.findById(trip.driver_id).lean() : null;
//       return { trip, vehicle, driver };
//     }));

//     await audit("system", "api", "getAllTrips", "Trip", "Completed trips fetched", "success");
//     res.json(enrichedTrips);
//   } catch (err) {
//     await error("system", "api", err, "AllTrips");
//     res.status(500).json({ message: "Error fetching trips", error: err.message });
//   }
// };
// */

// /**
//  * Get completed trip by ID
//  */
// exports.getTripById = async (req, res) => {
//   if (handleValidationErrors(req, res)) return;

//   try {
//     const tripId = req.params.tripId;
//     console.log(`[getTripById] Fetching completed trip summary for tripId=${tripId}`);

//     const trip = await TripHistory.findById(tripId).lean();
//     if (!trip) {
//       await audit("system", "api", "getTripById", "Trip", `Trip ${tripId} not found`, "failed");
//       return res.status(404).json({ message: "Trip not found" });
//     }

//     const vehicle = trip.vehicle_id ? await Vehicle.findById(trip.vehicle_id).lean() : null;
//     const driver = trip.driver_id ? await Driver.findById(trip.driver_id).lean() : null;

//     await audit("system", "api", "getTripById", "Trip", `Trip ${tripId} summary fetched`, "success");
//     res.json({ trip, vehicle, driver });
//   } catch (err) {
//     await error("system", "api", err, "TripById");
//     res.status(500).json({ message: "Error fetching trip summary", error: err.message });
//   }
// };

// /**
//  * Get completed trips by vehicle ID
//  */
// exports.getTripsByVehicle = async (req, res) => {

//   console.log("[getTripsByVehicle] Fetching completed trips by VehicleId: ", req.params.vehicleId);

//   if (handleValidationErrors(req, res)) return;

//   try {
//     const vehicleId = req.params.vehicleId;
//     console.log(`[getTripsByVehicle] Fetching completed trips for vehicleId=${vehicleId}`);

//     const trips = await TripHistory.find({ vehicle_id: vehicleId }).sort({ departure_time: -1 }).lean();
//     const vehicle = await Vehicle.findById(vehicleId).lean();

//     const enrichedTrips = await Promise.all(trips.map(async trip => {
//       const driver = trip.driver_id ? await Driver.findById(trip.driver_id).lean() : null;
//       return { trip, driver };
//     }));

//     await audit("system", "api", "getTripsByVehicle", "Trip", `Trips fetched for vehicle ${vehicleId}`, "success");
//     res.json({ vehicle, trips: enrichedTrips });
//   } catch (err) {
//     await error("system", "api", err, "TripsByVehicle");
//     res.status(500).json({ message: "Error fetching trips by vehicle", error: err.message });
//   }
// };

// /**
//  * Get completed trips by driver ID
//  */
// exports.getTripsByDriver = async (req, res) => {
//   console.log("[getTripsByDriver] Fetching completed trips by driverId: ", req.params.driverId);

//   if (handleValidationErrors(req, res)) return;

//   try {
//     const driverId = req.params.driverId;
//     console.log(`[getTripsByDriver] Fetching completed trips for driverId=${driverId}`);

//     const trips = await TripHistory.find({ driver_id: driverId }).sort({ departure_time: -1 }).lean();
//     const driver = await Driver.findById(driverId).lean();

//     const enrichedTrips = await Promise.all(trips.map(async trip => {
//       const vehicle = trip.vehicle_id ? await Vehicle.findById(trip.vehicle_id).lean() : null;
//       return { trip, vehicle };
//     }));

//     await audit("system", "api", "getTripsByDriver", "Trip", `Trips fetched for driver ${driverId}`, "success");
//     res.json({ driver, trips: enrichedTrips });
//   } catch (err) {
//     await error("system", "api", err, "TripsByDriver");
//     res.status(500).json({ message: "Error fetching trips by driver", error: err.message });
//   }
// };


// /**
//  * Get route geometry for a completed trip
//  */
// //  updated json response code --- 28/02/2026

// // Controller to fetch geometry for a given tripId
// exports.fetchRouteGeometry = async (req, res) => {
//   if (handleValidationErrors(req, res)) return;

//   const tripId = req.params.tripId;
//   console.log("[tripController] fetchRouteGeometry called with tripId:", tripId);

//   try {
//     const trip = await TripHistory.findById(tripId)
//       .populate({
//         path: "route_id",
//         select: "geometry name place_from place_to source destination"
//       })
//       .populate({
//         path: "vehicle_id",
//         select: "registration_number make model"
//       })
//       .populate({
//         path: "driver_id",
//         select: "driver_name mobile_number"
//       })
//       .select("+trip_arrival_status +trip_actual_arrival_time +trip_arrival_notes")
//       .lean();

//     if (!trip) {
//       console.error("[tripController] Trip not found for ID:", tripId);
//       return res.status(404).json({
//         success: false,
//         message: "Trip not found"
//       });
//     }

//     if (!trip.route_id || !trip.route_id.geometry) {
//       console.error("[tripController] Geometry not available for route:", trip.route_id?._id);
//       return res.status(404).json({
//         success: false,
//         message: "Geometry not available for this route"
//       });
//     }

//     console.log("[tripController] Geometry successfully retrieved for route:", trip.route_id._id);

//     return res.status(200).json({
//       success: true,
//       data: {
//         tripId: trip._id,
//         route: {
//           id: trip.route_id._id,
//           name: trip.route_id.name,
//           from: trip.route_id.place_from,
//           to: trip.route_id.place_to,
//           source: trip.route_id.source,
//           destination: trip.route_id.destination,
//           geometry: trip.route_id.geometry
//         },
//         vehicle: trip.vehicle_id
//           ? {
//             id: trip.vehicle_id._id,
//             registrationNumber: trip.vehicle_id.registration_number,
//             make: trip.vehicle_id.make,
//             model: trip.vehicle_id.model
//           }
//           : null,
//         driver: trip.driver_id
//           ? {
//             id: trip.driver_id._id,
//             name: trip.driver_id.driver_name,
//             mobileNumber: trip.driver_id.mobile_number
//           }
//           : null,
//         arrival: {
//           status: trip.trip_arrival_status || "N/A",
//           time: trip.trip_actual_arrival_time || null,
//           notes: trip.trip_arrival_notes || ""
//         },
//         stats: {
//           max_speed: trip.max_speed || 0,
//           avg_speed: trip.avg_speed || 0,
//           total_distance: trip.total_distance || 0,
//           position_name: trip.position_name || null
//         }
//       }
//     });
//   } catch (err) {
//     await error("system", "api", err, "RouteGeometry");
//     console.error("[tripController] Error while fetching geometry:", err.message);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error"
//     });
//   }
// };

// // Old code commented on 28 Feb 2026
// /*
// exports.fetchRouteGeometry = async (req, res) => {
//   if (handleValidationErrors(req, res)) return;

//   try {
//     const tripId = req.params.tripId;
//     console.log("[fetchRouteGeometry] Fetching geometry for tripId:", tripId);

//     const trip = await TripHistory.findById(tripId)
//       .populate({
//         path: "route_id",
//         select: "geometry name place_from place_to source destination"
//       })
//       .populate({
//         path: "vehicle_id",
//         select: "registration_number make model"
//       })
//       .populate({
//         path: "driver_id",
//         select: "driver_name mobile_number"
//       })
//       .lean();

//     if (!trip) {
//       return res.status(404).json({ message: "Trip not found" });
//     }
//     if (!trip.route_id || !trip.route_id.geometry) {
//       return res.status(404).json({ message: "Geometry not available for this route" });
//     }

//     return res.json({
//       tripId: trip._id,
//       route: {
//         id: trip.route_id._id,
//         name: trip.route_id.name,
//         from: trip.route_id.place_from,
//         to: trip.route_id.place_to,
//         source: trip.route_id.source,
//         destination: trip.route_id.destination,
//         geometry: trip.route_id.geometry
//       },
//       vehicle: trip.vehicle_id || null,
//       driver: trip.driver_id || null
//     });
//   } catch (err) {
//     await error("system", "api", err, "RouteGeometry");
//     res.status(500).json({ message: "Error fetching route geometry", error: err.message });
//   }
// };
// */

