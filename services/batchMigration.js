// ./services/batchMigration.js
// 26-Feb-2026
// Migrate completed trip to history databases

const mongoose = require("mongoose");
const turf = require("@turf/turf");
const { audit, error } = require("../utils/logger");

// Import active models
const Trip = require("../models/trip");
const Route = require("../models/route");
const TripEvent = require("../models/tripEvent");

// Import history models
const TripHistory = require("../models/tripHistory");
const RouteHistory = require("../models/routeHistory");
const TripEventsHistory = require("../models/tripEventsHistory");

async function migrateBatch(limit = 100, session) {
  const completedTrips = await Trip.find({
    trip_arrival_status: { $in: ["INTIME", "ONTIME", "DELAYED"] },
    status: "ACTIVE"
  })
    .limit(limit)
    .session(session);

  for (const trip of completedTrips) {
    try {
      // --- Step 1: TripHistory snapshot ---
      const tripHistory = await TripHistory.create([{
        trip_id: trip._id,
        vehicle_id: trip.vehicle_id,
        driver_id: trip.driver_id,
        departure_time: trip.departure_time,
        arrival_time: trip.arrival_time,
        trip_arrival_status: trip.trip_arrival_status,
        trip_actual_arrival_time: trip.trip_actual_arrival_time,
        trip_arrival_notes: trip.trip_arrival_notes,
        assignment_desc: trip.assignment_desc,
        assigned_at: trip.assigned_at
      }], { session });

      // --- Step 2: RouteHistory snapshot ---
      const route = await Route.findById(trip.route_id).session(session);

      let distanceKm = null;
      if (route && route.geometry) {
        const line = turf.lineString(route.geometry.coordinates);
        distanceKm = turf.length(line, { units: "kilometers" });
      }

      await RouteHistory.create([{
        trip_id: tripHistory[0]._id,
        place_from: route.place_from,
        place_to: route.place_to,
        source: route.source,
        destination: route.destination,
        geometry: route.geometry,
        route_desc: `${route.place_from} → ${route.place_to}`,
        distance_km: distanceKm,
        checkpoints: route.checkpoints || []
      }], { session });

      // --- Step 3: TripEventsHistory snapshot ---
      const tripEvents = await TripEvent.find({ trip_id: trip._id }).session(session);

      await TripEventsHistory.create([{
        trip_id: tripHistory[0]._id,
        events: tripEvents.map(ev => ({
          timestamp: ev.timestamp,
          location: ev.location,
          speed: ev.speed,
          event_type: ev.event_type,
          notes: ev.notes
        }))
      }], { session });

      // --- Step 4: Mark trip as archived ---
      trip.status = "INACTIVE";
      await trip.save({ session });

      await audit(
        "system", // empId (system job)
        "cron",   // role
        "migrate", // action
        "Trip",    // resource
        `Trip ${trip._id} migrated successfully`,
        "success"
      );
    } catch (err) {
      await error(
        "system",
        "cron",
        err,
        "TripMigration",
        null,
        null,
        500
      );
      throw err; // rethrow to trigger transaction rollback
    }
  }

  return completedTrips.length;
}

async function migrateAllBatches(batchSize = 100) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let migratedCount = 0;
    let batchCount;

    do {
      batchCount = await migrateBatch(batchSize, session);
      migratedCount += batchCount;
      if (batchCount > 0) {
        await audit("system", "cron", "migrateBatch", "Trip", `Migrated batch of ${batchCount} trips`, "success");
      }
    } while (batchCount > 0);

    await session.commitTransaction();
    await audit("system", "cron", "migrateAllBatches", "Trip", `Migration completed. Total trips migrated: ${migratedCount}`, "success");
  } catch (err) {
    await session.abortTransaction();
    await error("system", "cron", err, "TripMigration", null, null, 500);
  } finally {
    session.endSession();
  }
}

module.exports = migrateAllBatches;

