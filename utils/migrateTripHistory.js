// ./utils/migrateTripToHistory.js
// 27-Feb-2026
// Utility: Migrate a single trip to history collections

const mongoose = require("mongoose");
const turf = require("@turf/turf");
const { audit, error } = require("../utils/logger");

// Active models
const Trip = require("../models/trip");
const Route = require("../models/route");

// History models
const TripHistory = require("../models/tripHistory");
const RouteHistory = require("../models/routeHistory");
const TripEventsHistory = require("../models/tripEventsHistory");
const tripEventsHistory = require("../models/tripEventsHistory");

/**
 * Migrate a single trip to history collections
 * @param {String} tripId - Trip ObjectId
 * @returns {Object} result { success, tripId, historyTripId }
 */
async function migrateTripToHistory(tripId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // --- Step 1: Fetch trip ---
        const trip = await Trip.findById(tripId).session(session);
        if (!trip) throw new Error(`Trip ${tripId} not found`);

        if (!["INTIME", "ONTIME", "DELAYED"].includes(trip.trip_arrival_status)) {
            throw new Error(`Trip ${tripId} not completed`);
        }

        // --- Step 2: TripHistory snapshot ---
        const [tripHistory] = await TripHistory.create([{
            trip_id: trip._id,
            vehicle_id: trip.vehicle_id,
            route_id: trip.route_id,
            driver_id: trip.driver_id,
            departure_time: trip.departure_time,
            arrival_time: trip.arrival_time,
            trip_arrival_status: trip.trip_arrival_status,
            trip_arrival_notes: trip.trip_arrival_notes,
            max_speed: trip.max_speed || 0,
            avg_speed: trip.avg_speed || 0,
            total_distance: trip.total_distance || 0,
            position_name: trip.position_name || null,
            assignment_desc: trip.assignment_desc,
            assigned_at: trip.assigned_at
        }], { session });

        // --- Step 3: RouteHistory snapshot ---
        const route = await Route.findById(trip.route_id).session(session);
        let distanceKm = null;

        if (route?.geometry) {
            const line = turf.lineString(route.geometry.coordinates);
            distanceKm = turf.length(line, { units: "kilometers" });
        }

        await RouteHistory.create([{
            trip_id: tripHistory._id,
            place_from: route?.place_from,
            place_to: route?.place_to,
            source: route?.source,
            destination: route?.destination,
            geometry: route?.geometry,
            route_desc: route ? `${route.place_from} → ${route.place_to}` : null,
            distance_km: distanceKm,
            checkpoints: route?.checkpoints || []
        }], { session });

        // --- Step 4: TripEventsHistory snapshot ---
        const tripEvents = await tripEventsHistory.find({ trip_id: trip._id }).session(session);

        await TripEventsHistory.create([{
            trip_id: tripHistory._id,
            events: tripEvents.map(ev => ({
                timestamp: ev.timestamp,
                location: ev.location,
                speed: ev.speed,
                event_type: ev.event_type,
                notes: ev.notes
            }))
        }], { session });

        // --- Step 5: Mark trip as archived ---
        trip.status = "INACTIVE";
        await trip.save({ session });

        await session.commitTransaction();

        await audit("system", "cron", "migrateTrip", "Trip", `Trip ${trip._id} migrated successfully`, "success");

        return { success: true, tripId: trip._id, historyTripId: tripHistory._id };
    } catch (err) {
        await session.abortTransaction();
        await error("system", "cron", err, "TripMigration", null, null, 500);
        return { success: false, tripId, error: err.message };
    } finally {
        session.endSession();
    }
}

module.exports = { migrateTripToHistory };
