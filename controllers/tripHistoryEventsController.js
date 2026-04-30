// ./controllers/tripHistoryEventsController.js
// Date: 26 Feb 2026
// Author: Suresh Gupta
// Purpose: Handles trip events queries

const { validationResult } = require("express-validator");
const TripHistory = require("../models/tripHistory");
const TripEventsHistory = require("../models/tripEventsHistory");
const logger = require("../utils/logger");

console.log("[tripHistoryEventsController] Controller loaded.");

/**
 * Utility: handle validation errors
 */
function handleValidationErrors(req, res) {
  console.log('req: ', req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("[ValidationError]", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }
}


/**
 * Get trip events by trip ID
 */
exports.getEventsByTripId = async (req, res) => {
  if (handleValidationErrors(req, res)) return;

  try {
    const tripId = req.params.tripId;
    console.log(`[getEventsByTripId] Fetching events for tripId=${tripId}`);

    const eventsHistory = await TripEventsHistory.findOne({ trip_id: tripId });
    if (!eventsHistory) {
      console.warn(`[getEventsByTripId] No events found for tripId=${tripId}`);

      await logger.audit(
        req.user?.employee_id || 'SYSTEM',
        req.user?.employee_id?.name || 'SYSTEM',
        req.user?.role || 'unknown',
        'read',
        'TripEvents',
        `No events found for trip ${tripId}`,
        'failed',
        req.user?.tenant_id || null,
        req.trace_id
      );

      return res.status(404).json({ message: "No events found" });
    }

    console.log(`[getEventsByTripId] Found ${eventsHistory.events.length} events for tripId=${tripId}`);

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'TripEvents',
      `Events fetched for trip ${tripId}, count: ${eventsHistory.events.length}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json(eventsHistory.events);
  } catch (err) {
    console.error("[getEventsByTripId] Error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'TripEvents',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ message: "Error fetching trip events", error: err.message });
  }
};


/**
 * Get trip events by vehicle ID
 */
exports.getEventsByVehicle = async (req, res) => {
  if (handleValidationErrors(req, res)) return;

  try {
    const vehicleId = req.params.vehicleId;
    console.log(`[getEventsByVehicle] Fetching events for vehicleId=${vehicleId}`);

    const trips = await TripHistory.find({ vehicle_id: vehicleId });
    const events = await Promise.all(trips.map(async trip => {
      const ev = await TripEventsHistory.findOne({ trip_id: trip._id });
      return { trip_id: trip._id, events: ev ? ev.events : [] };
    }));

    console.log(`[getEventsByVehicle] Found events for ${trips.length} trips linked to vehicleId=${vehicleId}`);

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'TripEvents',
      `Events fetched for vehicle ${vehicleId}, trip count: ${trips.length}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json({ vehicleId, events });
  } catch (err) {
    console.error("[getEventsByVehicle] Error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'TripEvents',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ message: "Error fetching events by vehicle", error: err.message });
  }
};


/**
 * Get trip events by driver ID
 */
exports.getEventsByDriver = async (req, res) => {
  if (handleValidationErrors(req, res)) return;

  try {
    const driverId = req.params.driverId;
    console.log(`[getEventsByDriver] Fetching events for driverId=${driverId}`);

    const trips = await TripHistory.find({ driver_id: driverId });
    const events = await Promise.all(trips.map(async trip => {
      const ev = await TripEventsHistory.findOne({ trip_id: trip._id });
      return { trip_id: trip._id, events: ev ? ev.events : [] };
    }));

    console.log(`[getEventsByDriver] Found events for ${trips.length} trips linked to driverId=${driverId}`);

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'TripEvents',
      `Events fetched for driver ${driverId}, trip count: ${trips.length}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json({ driverId, events });
  } catch (err) {
    console.error("[getEventsByDriver] Error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'TripEvents',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ message: "Error fetching events by driver", error: err.message });
  }
};


/**
 * Get all trip events
 */
exports.getAllEvents = async (req, res) => {
  try {
    console.log("[getAllEvents] Fetching all trip events");

    const allEvents = await TripEventsHistory.find();
    console.log(`[getAllEvents] Found ${allEvents.length} trip event documents`);

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'TripEvents',
      `All trip events fetched, count: ${allEvents.length}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json(allEvents);
  } catch (err) {
    console.error("[getAllEvents] Error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'TripEvents',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ message: "Error fetching all trip events", error: err.message });
  }
};


/**
 * Get trip events by date range
 */
exports.getEventsByDateRange = async (req, res) => {
  if (handleValidationErrors(req, res)) return;

  try {
    const { startDate, endDate } = req.query;
    console.log(`[getEventsByDateRange] Fetching events between ${startDate} and ${endDate}`);

    const trips = await TripHistory.find({
      departure_time: { $gte: new Date(startDate), $lte: new Date(endDate) }
    });

    const events = await Promise.all(trips.map(async trip => {
      const ev = await TripEventsHistory.findOne({ trip_id: trip._id });
      return { trip_id: trip._id, events: ev ? ev.events : [] };
    }));

    console.log(`[getEventsByDateRange] Found events for ${trips.length} trips between ${startDate} and ${endDate}`);

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'TripEvents',
      `Events fetched between ${startDate} and ${endDate}, trip count: ${trips.length}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json(events);
  } catch (err) {
    console.error("[getEventsByDateRange] Error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'TripEvents',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ message: "Error fetching events by date range", error: err.message });
  }
};











// // ./controllers/tripHistoryEventsController.js
// // Date: 26 Feb 2026
// // Author: Suresh Gupta
// // Purpose: Handles trip events queries

// const { validationResult } = require("express-validator");
// const TripHistory = require("../models/tripHistory");
// const TripEventsHistory = require("../models/tripEventsHistory");
// const { audit, error } = require("../utils/logger");

// console.log("[tripHistoryEventsController] Controller loaded.");

// /**
//  * Utility: handle validation errors
//  */
// function handleValidationErrors(req, res) {
//     console.log('req: ', req);

//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         console.error("[ValidationError]", errors.array());
//         return res.status(400).json({ errors: errors.array() });
//     }
// }

// /**
//  * Get trip events by trip ID
//  */
// exports.getEventsByTripId = async (req, res) => {
//   if (handleValidationErrors(req, res)) return;

//   try {
//     const tripId = req.params.tripId;
//     console.log(`[getEventsByTripId] Fetching events for tripId=${tripId}`);

//     const eventsHistory = await TripEventsHistory.findOne({ trip_id: tripId });
//     if (!eventsHistory) {
//       console.warn(`[getEventsByTripId] No events found for tripId=${tripId}`);
//       await audit("system", "api", "getEventsByTripId", "TripEvents", `No events for trip ${tripId}`, "failed");
//       return res.status(404).json({ message: "No events found" });
//     }

//     console.log(`[getEventsByTripId] Found ${eventsHistory.events.length} events for tripId=${tripId}`);
//     await audit("system", "api", "getEventsByTripId", "TripEvents", `Events fetched for trip ${tripId}`, "success");
//     res.json(eventsHistory.events);
//   } catch (err) {
//     console.error("[getEventsByTripId] Error:", err);
//     await error("system", "api", err, "EventsByTripId");
//     res.status(500).json({ message: "Error fetching trip events", error: err.message });
//   }
// };

// /**
//  * Get trip events by vehicle ID
//  */
// exports.getEventsByVehicle = async (req, res) => {
//   if (handleValidationErrors(req, res)) return;

//   try {
//     const vehicleId = req.params.vehicleId;
//     console.log(`[getEventsByVehicle] Fetching events for vehicleId=${vehicleId}`);

//     const trips = await TripHistory.find({ vehicle_id: vehicleId });
//     const events = await Promise.all(trips.map(async trip => {
//       const ev = await TripEventsHistory.findOne({ trip_id: trip._id });
//       return { trip_id: trip._id, events: ev ? ev.events : [] };
//     }));

//     console.log(`[getEventsByVehicle] Found events for ${trips.length} trips linked to vehicleId=${vehicleId}`);
//     await audit("system", "api", "getEventsByVehicle", "TripEvents", `Events fetched for vehicle ${vehicleId}`, "success");
//     res.json({ vehicleId, events });
//   } catch (err) {
//     console.error("[getEventsByVehicle] Error:", err);
//     await error("system", "api", err, "EventsByVehicle");
//     res.status(500).json({ message: "Error fetching events by vehicle", error: err.message });
//   }
// };

// /**
//  * Get trip events by driver ID
//  */
// exports.getEventsByDriver = async (req, res) => {
//   if (handleValidationErrors(req, res)) return;

//   try {
//     const driverId = req.params.driverId;
//     console.log(`[getEventsByDriver] Fetching events for driverId=${driverId}`);

//     const trips = await TripHistory.find({ driver_id: driverId });
//     const events = await Promise.all(trips.map(async trip => {
//       const ev = await TripEventsHistory.findOne({ trip_id: trip._id });
//       return { trip_id: trip._id, events: ev ? ev.events : [] };
//     }));

//     console.log(`[getEventsByDriver] Found events for ${trips.length} trips linked to driverId=${driverId}`);
//     await audit("system", "api", "getEventsByDriver", "TripEvents", `Events fetched for driver ${driverId}`, "success");
//     res.json({ driverId, events });
//   } catch (err) {
//     console.error("[getEventsByDriver] Error:", err);
//     await error("system", "api", err, "EventsByDriver");
//     res.status(500).json({ message: "Error fetching events by driver", error: err.message });
//   }
// };

// /**
//  * Get all trip events
//  */
// exports.getAllEvents = async (req, res) => {
//   try {
//     console.log("[getAllEvents] Fetching all trip events");

//     const allEvents = await TripEventsHistory.find();
//     console.log(`[getAllEvents] Found ${allEvents.length} trip event documents`);

//     await audit("system", "api", "getAllEvents", "TripEvents", "All trip events fetched", "success");
//     res.json(allEvents);
//   } catch (err) {
//     console.error("[getAllEvents] Error:", err);
//     await error("system", "api", err, "AllEvents");
//     res.status(500).json({ message: "Error fetching all trip events", error: err.message });
//   }
// };

// /**
//  * Get trip events by date range
//  */
// exports.getEventsByDateRange = async (req, res) => {
//   if (handleValidationErrors(req, res)) return;

//   try {
//     const { startDate, endDate } = req.query;
//     console.log(`[getEventsByDateRange] Fetching events between ${startDate} and ${endDate}`);

//     const trips = await TripHistory.find({
//       departure_time: { $gte: new Date(startDate), $lte: new Date(endDate) }
//     });

//     const events = await Promise.all(trips.map(async trip => {
//       const ev = await TripEventsHistory.findOne({ trip_id: trip._id });
//       return { trip_id: trip._id, events: ev ? ev.events : [] };
//     }));

//     console.log(`[getEventsByDateRange] Found events for ${trips.length} trips between ${startDate} and ${endDate}`);
//     await audit("system", "api", "getEventsByDateRange", "TripEvents", `Events fetched between ${startDate} and ${endDate}`, "success");
//     res.json(events);
//   } catch (err) {
//     console.error("[getEventsByDateRange] Error:", err);
//     await error("system", "api", err, "EventsByDateRange");
//     res.status(500).json({ message: "Error fetching events by date range", error: err.message });
//   }
// };

