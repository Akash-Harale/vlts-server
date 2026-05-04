// /controllers/routeAssignmentController.js
const mongoose = require("mongoose");
const Route = require("../models/route");
const Trip = require("../models/trip");
const VehicleState = require("../models/vehicleState");
const Vehicle = require("../models/vehicle");
const DriverVehicle = require("../models/driverVehicleAssignment");
const { migrateTripToHistory } = require("../utils/migrateTripHistory");
const { generateGeofence } = require("../services/osmService");
const Geofence = require("../models/geofence");
const logger = require("../utils/logger");


// =======================================
// CREATE Trip
// TRANSACTION NEEDED: Route + Geofence + Trip + VehicleState + DriverVehicleAssignment
// all written atomically in one operation
// =======================================
exports.createTrip = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      route,
      vehicleId,
      driverId,
      departureTime,
      arrivalTime,
      assignment_desc,
      geofenceRadius,
    } = req.body;

    const place_from = route?.source;
    const place_to = route?.destination;

    if (!place_from || !place_to || !route?.geometry || !vehicleId || !departureTime || !arrivalTime) {
      return res.status(400).json({ success: false, message: "Missing required fields including geometry" });
    }

    const dep = new Date(departureTime);
    const arr = new Date(arrivalTime);

    if (arr <= dep) {
      return res.status(400).json({ success: false, message: "Arrival time must be after departure time" });
    }

    // Insert Route document
    const routeDoc = new Route({
      name: `${place_from} → ${place_to}`,
      place_from,
      place_to,
      source: route.geometry.coordinates[0],
      destination: route.geometry.coordinates[route.geometry.coordinates.length - 1],
      geometry: route.geometry,
    });
    await routeDoc.save({ session });

    // Generate & save Geofence
    const radiusMeters = geofenceRadius || 500;
    const polygon = generateGeofence(route.geometry, radiusMeters);
    const geofence = new Geofence({
      route_id: routeDoc._id,
      radius: radiusMeters,
      geometry: polygon,
    });
    await geofence.save({ session });

    // Insert Trip
    const assignment = new Trip({
      client_id: req.user?.client_profile_id,
      vehicle_id: vehicleId,
      route_id: routeDoc._id,
      driver_id: driverId || null,
      departure_time: dep,
      arrival_time: arr,
      assignment_desc,
      status: "ACTIVE",
    });
    await assignment.save({ session });

    // Insert/Update VehicleState
    const vehiclestate = await VehicleState.findOne({ vehicle_id: vehicleId });

    const vs = await VehicleState.findOneAndUpdate(
      { vehicle_id: vehicleId },
      {
        vehicle_id: vehicleId,
        prev_place_of_availability: vehiclestate.place_of_availability,
        prev_available_date: vehiclestate.next_available_date,
        place_of_availability: place_to,
        next_available_date: arr,
        status: "ACTIVE",
      },
      { upsert: true, new: true, session }
    );

    // Update route_id into driverVehicleAssignment
    const driverVehicleDoc = await DriverVehicle.findOneAndUpdate(
      { vehicle_id: vehicleId },
      { route_id: routeDoc._id },
      { new: true, session }
    );

    if (!driverVehicleDoc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "No driver-vehicle assignment found for this vehicle" });
    }

    const vehicleDoc = await Vehicle.findById(vehicleId).session(session);

    await session.commitTransaction();
    session.endSession();

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'create',
      'trip',
      `Trip created for vehicle ${vehicleId} on route ${routeDoc._id}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.status(201).json({
      success: true,
      message: "Vehicle assigned to route successfully",
      data: {
        route: {
          _id: routeDoc._id,
          name: routeDoc.name,
          place_from: routeDoc.place_from,
          place_to: routeDoc.place_to,
          source: routeDoc.source,
          destination: routeDoc.destination,
        },
        geofence: {
          _id: geofence._id,
          route_id: geofence.route_id,
          radius: geofence.radius,
          geometry: geofence.geometry,
        },
        assignment: {
          _id: assignment._id,
          vehicle_id: assignment.vehicle_id,
          driver_id: assignment.driver_id,
          route_id: assignment.route_id,
          departure_time: assignment.departure_time,
          arrival_time: assignment.arrival_time,
          assignment_desc: assignment.assignment_desc,
          status: assignment.status,
          assigned_at: assignment.assigned_at,
        },
        vehicle: vehicleDoc
          ? {
              id: vehicleDoc._id,
              registration_number: vehicleDoc.registration_number,
              make: vehicleDoc.make,
              model: vehicleDoc.model,
            }
          : null,
        vs,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("createTrip error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'trip',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ success: false, error: err.message });
  }
};


// =======================================
// FETCH ALL TRIPS (read only → no transaction)
// =======================================
exports.fetchTrips = async (req, res) => {
  console.log("tripController: fetchTrips API: req.query: ", req.query);

  try {
    const { page = 1, limit = 10 } = req.query;

    const query = {
      status: "ACTIVE",
      trip_dep_status: "DEPARTED",
      trip_arrival_status: "AWAITED",
      client_id: req.user?.client_profile_id
    };

    const total = await Trip.countDocuments(query);

    const assignments = await Trip.find(query)
      .populate("route_id", "name place_from place_to source destination")
      .populate("vehicle_id", "registration_number make model")
      .populate("driver_id", "driver_name mobile_number email_id")
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
      total_distance: a.total_distance || 0,
      position_name: a.position_name || null,
      overspeed_count: a.overspeed_count || 0,
      __v: a.__v
    }));

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'trip',
      `All active departed trips fetched, page: ${page}, count: ${data.length}`,
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
      'trip',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ error: err.message });
  }
};


// =======================================
// FETCH TRIPS BY VEHICLE (read only → no transaction)
// =======================================
exports.fetchTripsByVehicle = async (req, res) => {
  console.log("tripController: fetchTripsByVehicle API: req.params: ", req.params.vehicleId, " : req.query: ", req.query);

  try {
    const vehicle_id = req.params.vehicleId;

    const {
      page = 1,
      limit = 10,
      status,
      trip_approval_status,
      trip_dep_status,
      trip_arrival_status
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (trip_approval_status) query.trip_approval_status = trip_approval_status;
    if (trip_dep_status) query.trip_dep_status = trip_dep_status;
    if (trip_arrival_status) query.trip_arrival_status = trip_arrival_status;
    if (vehicle_id) query.vehicle_id = vehicle_id;

    console.log('fetchTripsByVehicle: query filter: ', query);

    const total = await Trip.countDocuments(query);

    const assignments = await Trip.find(query)
      .populate("route_id", "name place_from place_to source destination")
      .populate("vehicle_id", "registration_number make model")
      .populate("driver_id", "driver_name mobile_number email_id")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const data = assignments.map(a => ({
      trip_id: a._id,
      vehicle_id: a.vehicle_id?._id ?? null,
      registration_number: a.vehicle_id?.registration_number ?? null,
      make: a.vehicle_id?.make ?? null,
      model: a.vehicle_id?.model ?? null,
      route_id: a.route_id?._id ?? null,
      route_name: a.route_id?.name ?? null,
      driver_id: a.driver_id?._id ?? null,
      driver_name: a.driver_id?.driver_name ?? null,
      mobile_number: a.driver_id?.mobile_number ?? null,
      departure_time: a.departure_time ?? null,
      arrival_time: a.arrival_time ?? null,
      assignment_desc: a.assignment_desc ?? null,
      assigned_at: a.assigned_at ?? null,
      status: a.status ?? null,
      trip_approval_status: a.trip_approval_status ?? null,
      trip_dep_status: a.trip_dep_status ?? null,
      trip_arrival_status: a.trip_arrival_status ?? null,
      trip_actual_arrival_time: a.trip_actual_arrival_time ?? null,
      max_speed: a.max_speed || 0,
      total_distance: a.total_distance || 0,
      position_name: a.position_name || null,
      overspeed_count: a.overspeed_count || 0,
      __v: a.__v
    }));

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'trip',
      `Trips fetched for vehicle ${vehicle_id}, count: ${data.length}`,
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
    console.error("Error fetching trips by vehicle:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'trip',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ error: err.message });
  }
};


// =======================================
// FETCH ROUTE GEOMETRY (read only → no transaction)
// =======================================
exports.fetchRouteGeometry = async (req, res) => {
  const tripId = req.params.tripId;
  console.log("[tripController] getRouteGeometry called with tripId:", tripId);

  try {
    const trip = await Trip.findById(tripId)
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
      `Route geometry fetched for trip ${tripId}`,
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
        stats: {
          max_speed: trip.max_speed || 0,
          avg_speed: trip.avg_speed || 0,
          total_distance: trip.total_distance || 0,
          position_name: trip.position_name || null,
          overspeed_count: trip.overspeed_count || 0,
          geofence_crossing_count: trip.geofence_crossing_count || 0
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


// =======================================
// FETCH TRIPS BY STATUS (read only → no transaction)
// =======================================
exports.fetchTripsByStatus = async (req, res) => {
  console.log('tripController: fetchTripsByStatus: req.query: ', req.query);

  try {
    const { trip_approval_status, trip_dep_status } = req.query;

    const filter = {};
    if (trip_approval_status && trip_dep_status) {
      filter.trip_approval_status = trip_approval_status;
      filter.trip_dep_status = trip_dep_status;
    } else if (trip_approval_status) {
      filter.trip_approval_status = trip_approval_status;
    } else if (trip_dep_status) {
      filter.trip_dep_status = trip_dep_status;
    } else {
      return res.status(404).json({
        success: false,
        message: "Provide trip_approval_status or trip_dep_status (or both) to filter assignments"
      });
    }

    const assignments = await Trip.find(filter)
      .populate("route_id")
      .populate("driver_id", "driver_name driver_license mobile_number")
      .populate("vehicle_id", "registration_number make model");

    console.log('tripController: fetchTripsByStatus trips: ', assignments);

    if (!assignments || assignments.length === 0) {
      return res.status(404).json({ success: false, message: "No assignments found" });
    }

    const vehicleIds = assignments.map(a => a.vehicle_id?._id || a.vehicle_id);
    const vehicleStates = await VehicleState.find({ vehicle_id: { $in: vehicleIds } });

    const json_response_data = assignments.map(a => ({
      route: a.route_id
        ? {
          _id: a.route_id._id,
          name: a.route_id.name,
          place_from: a.route_id.place_from,
          place_to: a.route_id.place_to,
          source: a.route_id.source,
          destination: a.route_id.destination,
          geometry: a.route_id.geometry
        }
        : null,
      assignment: {
        _id: a._id,
        route_id: a.route_id?._id || null,
        vehicle_id: a.vehicle_id?._id || a.vehicle_id,
        driver_id: a.driver_id ? a.driver_id._id : null,
        departure_time: a.departure_time,
        arrival_time: a.arrival_time,
        assignment_desc: a.assignment_desc,
        assigned_at: a.assigned_at,
        status: a.status,
        max_speed: a.max_speed || 0,
        avg_speed: a.avg_speed || 0,
        total_distance: a.total_distance || 0,
        position_name: a.position_name || null,
        overspeed_count: a.overspeed_count || 0,
        geofence_crossing_count: a.geofence_crossing_count || 0,
        trip_approval_status: a.trip_approval_status,
        trip_dep_status: a.trip_dep_status,
        trip_arrival_status: a.trip_arrival_status,
        trip_actual_arrival_time: a.trip_actual_arrival_time,
        trip_arrival_notes: a.trip_arrival_notes
      },
      vehicle: a.vehicle_id
        ? {
          id: a.vehicle_id._id,
          registration_number: a.vehicle_id.registration_number,
          make: a.vehicle_id.make,
          model: a.vehicle_id.model
        }
        : null,
      vehicleState: vehicleStates.find(
        vs =>
          vs.vehicle_id.toString() ===
          (a.vehicle_id?._id?.toString() || a.vehicle_id.toString())
      ),
      driver: a.driver_id
        ? {
          id: a.driver_id._id || null,
          driver_name: a.driver_id.driver_name || null,
          driver_license: a.driver_id.driver_license || null,
          driver_mobile: a.driver_id.mobile_number || null,
        }
        : null,
    }));

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'trip',
      `Trips fetched by status filter: ${JSON.stringify(filter)}, count: ${json_response_data.length}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.status(200).json({
      success: true,
      message: "Assigned route(s) fetched successfully",
      data: json_response_data
    });
  } catch (err) {
    console.error("fetchAssignedRoute error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'trip',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ success: false, error: err.message });
  }
};


// =======================================
// UPDATE TRIP STATUS
// TRANSACTION NEEDED: Trip + VehicleState both written on cancellation
// =======================================
exports.updateTripStatus = async (req, res) => {
  console.log("tripController: updateTripStatus API called: req.params: ", req.params.tripId, " : req.body:", req.body);

  const assignment_id = req.params.tripId;
  console.log('tripController: updateTripStatus API: assignment_id: ', assignment_id);

  const {
    trip_approval_status,
    trip_dep_status,
    trip_arrival_status,
    trip_actual_arrival_time,
    trip_arrival_notes
  } = req.body;

  if (!assignment_id) {
    return res.status(400).json({
      success: false,
      message: "Provide assignment_id in req.params to update!"
    });
  }

  if (!trip_approval_status && !trip_dep_status && !trip_arrival_status) {
    return res.status(400).json({
      success: false,
      message:
        "Provide either trip_approval_status (APPROVED/CANCELLED) or trip_dep_status (DEPARTED/CANCELLED) or trip_arrival_status (INTIME/ONTIME/DELAYED)"
    });
  }

  if (trip_arrival_status) {
    if (trip_arrival_status != "INTIME" && trip_arrival_status != "ONTIME" && trip_arrival_status != "DELAYED") {
      return res.status(404).json({
        success: false,
        message: "Check trip_arrival_status should be INTIME or ONTIME or DELAYED"
      });
    } else if (!trip_actual_arrival_time && !trip_arrival_notes) {
      return res.status(404).json({
        success: false,
        message: "Check trip_actaul_arrival_time/trip_arrival_notes empty"
      });
    }
  }

  // Determine if cancellation path will be taken (Trip + VehicleState both written)
  const isCancellation =
    trip_approval_status === "CANCELLED" || trip_dep_status === "CANCELLED";

  // Use transaction only when cancellation updates both Trip and VehicleState
  const session = isCancellation ? await mongoose.startSession() : null;
  if (session) session.startTransaction();

  try {
    const trip = await Trip.findById(assignment_id);

    if (!trip) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({
        success: false,
        message: "No trip found to update status"
      });
    }

    if (trip_dep_status === "DEPARTED") {
      if (trip.trip_approval_status !== "APPROVED") {
        if (session) {
          await session.abortTransaction();
          session.endSession();
        }
        return res.status(403).json({
          success: false,
          message: "Forbidden: Trip is not approved."
        });
      }
      if (!trip.driver_id) {
        if (session) {
          await session.abortTransaction();
          session.endSession();
        }
        return res.status(403).json({
          success: false,
          message: "Forbidden: Driver is not mapped to the Vehicle."
        });
      }
    }

    if (["INTIME", "ONTIME", "DELAYED"].includes(trip_arrival_status)) {
      if (trip.trip_approval_status !== "APPROVED") {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Trip is not approved."
        });
      }
      if (trip.trip_dep_status !== "DEPARTED") {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Trip has not departed."
        });
      }
    }

    const updateFields = {};
    if (trip_approval_status) updateFields.trip_approval_status = trip_approval_status;
    if (trip_dep_status) updateFields.trip_dep_status = trip_dep_status;
    if (trip_arrival_status) {
      updateFields.trip_arrival_status = trip_arrival_status;
      updateFields.status = 'INACTIVE';
      if (trip_actual_arrival_time) updateFields.trip_actual_arrival_time = trip_actual_arrival_time;
      if (trip_arrival_notes) updateFields.trip_arrival_notes = trip_arrival_notes;
    }

    // Handle cancellation: restore vehicle state (Trip + VehicleState → transaction active)
    if (isCancellation) {
      try {
        const vs = session
          ? await VehicleState.findById(trip.vehicle_id).session(session)
          : await VehicleState.findById(trip.vehicle_id);

        if (!vs) {
          if (session) {
            await session.abortTransaction();
            session.endSession();
          }
          return res.status(404).json({
            success: false,
            message: "Vehicle state not found to restore"
          });
        }

        vs.place_of_availability = vs.prev_place_of_availability;
        vs.next_available_date = vs.prev_available_date;
        vs.prev_place_of_availability = null;
        vs.prev_available_date = null;

        if (session) {
          await vs.save({ session });
        } else {
          await vs.save();
        }
      } catch (err) {
        console.error("Error restoring vehicle state:", err.message);
        if (session) {
          await session.abortTransaction();
          session.endSession();
        }
        return res.status(500).json({ success: false, message: err.message });
      }
    }

    const updatedTrip = session
      ? await Trip.findByIdAndUpdate(assignment_id, updateFields, { new: true, runValidators: true, session })
      : await Trip.findByIdAndUpdate(assignment_id, updateFields, { new: true, runValidators: true });

    if (!updatedTrip) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({
        success: false,
        message: "Trip not found, please retry"
      });
    }

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'update',
      'trip',
      `Trip status updated for trip ${assignment_id}: ${JSON.stringify(updateFields)}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json({
      success: true,
      message: "Trip status updated successfully",
      data: updatedTrip
    });

    if (["INTIME", "ONTIME", "DELAYED"].includes(trip_arrival_status)) {
      const result = migrateTripToHistory(assignment_id);
      console.log(" [INFO] migrateTripToHistory result:", result);
    }

  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error(" [ERROR] updateTripStatus failed:", err.message);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'trip',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};


// =======================================
// GET TRIPS BY VEHICLE OR DRIVER (read only → no transaction)
// =======================================
exports.getTripsByVehicleOrDriver = async (req, res) => {
  console.log("tripController: getTripsByVehicleOrDriver API: req.query: ", req.query);

  try {
    const { vehicle_id, driver_id } = req.query;

    const page = 1;
    const limit = 10;

    let query;

    if (vehicle_id) {
      query = {
        vehicle_id: vehicle_id,
        status: "ACTIVE",
        trip_dep_status: "DEPARTED"
      };
    } else if (driver_id) {
      query = {
        driver_id: driver_id,
        status: "ACTIVE",
        trip_dep_status: "DEPARTED"
      };
    } else {
      console.log("Provide either vehicle_id or driver_id to fetch Trips");
      return res.status(400).json({
        success: false,
        message: "Provide either vehicle_id or driver_id to fetch Trips"
      });
    }

    const total = await Trip.countDocuments(query);

    if (!total) {
      return res.status(404).json({ error: "No active Trips found for vehicle" });
    }

    const assignments = await Trip.find(query)
      .populate("route_id", "name place_from place_to source destination")
      .populate("vehicle_id", "registration_number make model")
      .populate("driver_id", "driver_name mobile_number email_id")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const data = assignments.map(a => ({
      _id: a._id,
      vehicle_id: a.vehicle_id,
      route_id: a.route_id,
      driver_id: a.driver_id,
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
      'trip',
      `Trips fetched for ${vehicle_id ? `vehicle ${vehicle_id}` : `driver ${driver_id}`}, count: ${data.length}`,
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
      'trip',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ error: err.message });
  }
};


// =======================================
// ASSIGN VEHICLE TO ROUTE (PoC - read only checks + single Trip write → no transaction)
// =======================================
exports.assignVehicleToRoute = async (req, res) => {
  try {
    const { route_id, vehicle_id } = req.body;

    const route = await Route.findById(route_id);
    if (!route) return res.status(404).json({ error: "Route not found" });

    const vehicle = await Vehicle.findById(vehicle_id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const driverAssignment = await DriverVehicle
      .findOne({ vehicle_id, status: "ACTIVE" })
      .populate("driver_id", "driver_name mobile_number email_id");

    let driver_id = null;
    if (driverAssignment && driverAssignment.driver_id) {
      driver_id = driverAssignment.driver_id._id;
      console.log(`[ASSIGN ROUTE] Vehicle ${vehicle_id} is assigned to driver:`, driverAssignment.driver_id.driver_name);
    } else {
      console.warn(`[WARN] No active driver found for vehicle ${vehicle_id} during route assignment`);
    }

    const existingAssignment = await Trip.findOne({ vehicle_id, status: "ACTIVE" });
    if (existingAssignment) {
      return res.status(409).json({
        error: "This vehicle is already assigned to another active route",
      });
    }

    const assignment = new Trip({ route_id, vehicle_id, driver_id });
    await assignment.save();

    const populatedAssignment = await Trip.findById(assignment._id)
      .populate("route_id", "name source destination")
      .populate("vehicle_id", "registration_number model")
      .populate("driver_id", "driver_name mobile_number email_id");

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'create',
      'trip',
      `Vehicle ${vehicle_id} assigned to route ${route_id}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.status(201).json(populatedAssignment);
  } catch (err) {
    console.error("Error assigning vehicle to route:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'trip',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ error: err.message || "Internal server error" });
  }
};


// =======================================
// GET VEHICLES BY ROUTE (read only → no transaction)
// =======================================
exports.getVehiclesByRoute = async (req, res) => {
  try {
    const { route_id } = req.params;
    const assignments = await Trip.find({ route_id, status: "ACTIVE" })
      .populate("vehicle_id", "registration_number model driver_name");

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'read',
      'trip',
      `Vehicles fetched for route ${route_id}, count: ${assignments.length}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json(assignments);
  } catch (err) {
    console.error("getVehiclesByRoute error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'trip',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ error: err.message });
  }
};


// =======================================
// UPDATE TRIP (single Trip write → no transaction)
// =======================================
exports.updateTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicle_id, route_id } = req.body;

    const assignment = await Trip.findById(id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });

    const route = await Route.findById(route_id);
    const vehicle = await Vehicle.findById(vehicle_id);
    if (!route || !vehicle) {
      return res.status(404).json({ message: "Route or Vehicle not found" });
    }

    assignment.vehicle_id = vehicle_id;
    assignment.route_id = route_id;
    await assignment.save();

    const updatedAssignment = await Trip.findById(id)
      .populate("vehicle_id", "registration_number model driver_name")
      .populate("route_id", "name source destination");

    await logger.audit(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      'update',
      'trip',
      `Trip ${id} updated with vehicle ${vehicle_id} and route ${route_id}`,
      'success',
      req.user?.tenant_id || null,
      req.trace_id
    );

    res.json(updatedAssignment);
  } catch (err) {
    console.error("Update assignment error:", err);

    await logger.error(
      req.user?.employee_id || 'SYSTEM',
      req.user?.employee_id?.name || 'SYSTEM',
      req.user?.role || 'unknown',
      err,
      'trip',
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );

    res.status(500).json({ message: err.message });
  }
};











// // /controllers/routeAssignmentController.js
// const mongoose = require("mongoose");
// const Route = require("../models/route");
// const Trip = require("../models/trip");
// const VehicleState = require("../models/vehicleState"); 
// const Vehicle = require("../models/vehicle");
// const DriverVehicle = require("../models/driverVehicleAssignment");
// const vehicleState = require("../models/vehicleState");
// const { migrateTripToHistory } = require("../utils/migrateTripHistory");
// const { generateGeofence } = require("../services/osmService");
// const Geofence = require("../models/geofence");                          // ← NEW

// // Create Route with Vehicle mapped
// /*
// Transaction Start: mongoose.startSession() + session.startTransaction().
// Atomic Inserts: Each .save() or .findOneAndUpdate() is passed { session }.
// Commit/Rollback: If all succeed → commitTransaction(). If any fail → abortTransaction().
// Consistency: Ensures no partial inserts (e.g., assignment without route/state).

// POST  
// http://localhost:3005/api/trips

// Body (raw JSON):

// {
//   "route": {
//     "source": "Delhi Railway Station",
//     "destination": "Noida Sector 18",
//     "geometry": {
//       "type": "LineString",
//       "coordinates": [
//         [77.2090, 28.6139],
//         [77.5000, 28.4000],
//         [78.0081, 27.1767]
//       ]
//     }
//   },
//   "departureTime": "2026-02-18T09:00:00.000Z",
//   "arrivalTime": "2026-02-18T09:30:00.000Z",
//   "vehicleId": "67b456789abcdef012345678",
//   "assignment_desc": "Morning shuttle"
// }

// Response:
// {
//   "success": true,
//   "message": "Vehicle assigned to route successfully",
//   "data": {
//     "route": {
//       "_id": "67b123e4f9a8c2d345678901",
//       "name": "Delhi Railway Station → Noida Sector 18",
//       "source": [77.2090, 28.6139],
//       "destination": [78.0081, 27.1767]
//     },
//     "assignment": {
//       "_id": "67b9999999abcdef012345678",
//       "vehicle_id": "67b456789abcdef012345678",
//       "route_id": "67b123e4f9a8c2d345678901",
//       "assignment_desc": "Morning shuttle",
//       "status": "ACTIVE",
//       "assigned_at": "2026-02-18T09:00:00.000Z"
//     },
//     "vehicleState": {
//       "_id": "67b8888888abcdef012345678",
//       "vehicle_id": "67b456789abcdef012345678",
//       "place_of_availability": "Noida Sector 18",
//       "next_available_date": "2026-02-18T09:30:00.000Z",
//       "status": "ACTIVE"
//     }
//   }
// }
// */


// exports.createTrip = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const {
//       route,
//       vehicleId,
//       driverId,
//       departureTime,
//       arrivalTime,
//       assignment_desc,
//       geofenceRadius,                                                     // ← NEW
//     } = req.body;

//     const place_from = route?.source;
//     const place_to = route?.destination;

//     if (!place_from || !place_to || !route?.geometry || !vehicleId || !departureTime || !arrivalTime) {
//       return res.status(400).json({ success: false, message: "Missing required fields including geometry" });
//     }

//     const dep = new Date(departureTime);
//     const arr = new Date(arrivalTime);

//     if (arr <= dep) {
//       return res.status(400).json({ success: false, message: "Arrival time must be after departure time" });
//     }

//     // Insert Route document
//     const routeDoc = new Route({
//       name: `${place_from} → ${place_to}`,
//       place_from,
//       place_to,
//       source: route.geometry.coordinates[0],
//       destination: route.geometry.coordinates[route.geometry.coordinates.length - 1],
//       geometry: route.geometry,
//     });
//     await routeDoc.save({ session });

//     // ── Generate & save Geofence ──────────────────────────────────────────── NEW
//     const radiusMeters = geofenceRadius || 500;
//     const polygon = generateGeofence(route.geometry, radiusMeters);
//     const geofence = new Geofence({
//       route_id: routeDoc._id,
//       radius: radiusMeters,
//       geometry: polygon,
//     });
//     await geofence.save({ session });
//     // ─────────────────────────────────────────────────────────────────────────

//     // Insert Trip
//     const assignment = new Trip({
//       vehicle_id: vehicleId,
//       route_id: routeDoc._id,
//       driver_id: driverId || null,
//       departure_time: dep,
//       arrival_time: arr,
//       assignment_desc,
//       status: "ACTIVE",
//     });
//     await assignment.save({ session });

//     // Insert/Update VehicleState
//     const vehiclestate = await VehicleState.findOne({ vehicle_id: vehicleId });

//     const vs = await VehicleState.findOneAndUpdate(
//       { vehicle_id: vehicleId },
//       {
//         vehicle_id: vehicleId,
//         prev_place_of_availability: vehiclestate.place_of_availability,
//         prev_available_date: vehiclestate.next_available_date,
//         place_of_availability: place_to,
//         next_available_date: arr,
//         status: "ACTIVE",
//       },
//       { upsert: true, new: true, session }
//     );

//     // Update route_id into driverVehicleAssignment
//     const driverVehicleDoc = await DriverVehicle.findOneAndUpdate(
//       { vehicle_id: vehicleId },
//       { route_id: routeDoc._id },
//       { new: true, session }
//     );

//     if (!driverVehicleDoc) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({ success: false, message: "No driver-vehicle assignment found for this vehicle" });
//     }

//     const vehicleDoc = await Vehicle.findById(vehicleId).session(session);

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       message: "Vehicle assigned to route successfully",
//       data: {
//         route: {
//           _id: routeDoc._id,
//           name: routeDoc.name,
//           place_from: routeDoc.place_from,
//           place_to: routeDoc.place_to,
//           source: routeDoc.source,
//           destination: routeDoc.destination,
//         },
//         geofence: {                                                       // ← NEW
//           _id: geofence._id,
//           route_id: geofence.route_id,
//           radius: geofence.radius,
//           geometry: geofence.geometry,
//         },
//         assignment: {
//           _id: assignment._id,
//           vehicle_id: assignment.vehicle_id,
//           driver_id: assignment.driver_id,
//           route_id: assignment.route_id,
//           departure_time: assignment.departure_time,
//           arrival_time: assignment.arrival_time,
//           assignment_desc: assignment.assignment_desc,
//           status: assignment.status,
//           assigned_at: assignment.assigned_at,
//         },
//         vehicle: vehicleDoc
//           ? {
//               id: vehicleDoc._id,
//               registration_number: vehicleDoc.registration_number,
//               make: vehicleDoc.make,
//               model: vehicleDoc.model,
//             }
//           : null,
//         vs,
//       },
//     });
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("createTrip error:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// // Fetch all trips  -- Get All
// /*
// Fixed .populate() calls → one for route_id, one for vehicle_id.
// Excluded geometry field explicitly with -geometry.
// Handled empty array properly.
// Added driver_name in vehicle summary for completeness.
// */
// exports.fetchTrips = async (req, res) => {

//   console.log("tripController: fetchTrips API: req.query: ", req.query);

//   try {
//     const { page = 1, limit = 10 } = req.query;

//     const query = {
//       status: "ACTIVE",
//       trip_dep_status: "DEPARTED",
//       trip_arrival_status: "AWAITED"
//     };

//     // Get total count first 
//     const total = await Trip.countDocuments(query);

//     // Fetch paginated results
//     const assignments = await Trip.find(query)
//       .populate("route_id", "name place_from place_to source destination")
//       .populate("vehicle_id", "registration_number make model")
//       .populate("driver_id", "driver_name mobile_number email_id")
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
//       total_distance: a.total_distance || 0,
//       position_name: a.position_name || null,
//       overspeed_count: a.overspeed_count || 0,
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


// // Fetch trips by vehicle_id
// /*
// Fixed .populate() calls → one for route_id, one for vehicle_id.
// Excluded geometry field explicitly with -geometry.
// Handled empty array properly.
// Added driver_name in vehicle summary for completeness.
// Improved logging for debugging.
// */
// exports.fetchTripsByVehicle = async (req, res) => {
//   console.log("tripController: fetchTripsByVehicle API: req.params: ", req.params.vehicleId, " : req.query: ", req.query);

//   try {
//     const vehicle_id = req.params.vehicleId;

//     const {
//       page = 1,
//       limit = 10,
//       status,
//       trip_approval_status,
//       trip_dep_status,
//       trip_arrival_status
//     } = req.query;

//     const query = {};

//     // Apply filters only if provided
//     if (status) query.status = status;
//     if (trip_approval_status) query.trip_approval_status = trip_approval_status;
//     if (trip_dep_status) query.trip_dep_status = trip_dep_status;
//     if (trip_arrival_status) query.trip_arrival_status = trip_arrival_status;

//     if (vehicle_id) {
//       query.vehicle_id = vehicle_id; // expecting ObjectId string 
//     }

//     console.log('fetchTripsByVehicle: query filter: ', query);

//     // Get total count first 
//     const total = await Trip.countDocuments(query);

//     // Fetch paginated results
//     const assignments = await Trip.find(query)
//       .populate("route_id", "name place_from place_to source destination")
//       .populate("vehicle_id", "registration_number make model")
//       .populate("driver_id", "driver_name mobile_number email_id")
//       .sort({ createdAt: -1 }) // newest first
//       .skip((page - 1) * limit)
//       .limit(parseInt(limit))
//       .lean();

//     const data = assignments.map(a => ({
//       trip_id: a._id,
//       vehicle_id: a.vehicle_id?._id ?? null,
//       registration_number: a.vehicle_id?.registration_number ?? null,
//       make: a.vehicle_id?.make ?? null,
//       model: a.vehicle_id?.model ?? null,
//       route_id: a.route_id?._id ?? null,
//       route_name: a.route_id?.name ?? null,
//       driver_id: a.driver_id?._id ?? null,
//       driver_name: a.driver_id?.driver_name ?? null,
//       mobile_number: a.driver_id?.mobile_number ?? null,
//       departure_time: a.departure_time ?? null,
//       arrival_time: a.arrival_time ?? null,
//       assignment_desc: a.assignment_desc ?? null,
//       assigned_at: a.assigned_at ?? null,
//       status: a.status ?? null,
//       trip_approval_status: a.trip_approval_status ?? null,
//       trip_dep_status: a.trip_dep_status ?? null,
//       trip_arrival_status: a.trip_arrival_status ?? null,
//       trip_actual_arrival_time: a.trip_actual_arrival_time ?? null,
//       max_speed: a.max_speed || 0,
//       total_distance: a.total_distance || 0,
//       position_name: a.position_name || null,
//       overspeed_count: a.overspeed_count || 0,
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
//     console.error("Error fetching trips by vehicle:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // Fetch route geometry  by route_id
// // Controller to fetch geometry for a given tripId
// exports.fetchRouteGeometry = async (req, res) => {
//   const tripId = req.params.tripId;
//   console.log("[tripController] getRouteGeometry called with tripId:", tripId);

//   try {
//     // Fetch trip and populate route, vehicle, driver
//     const trip = await Trip.findById(tripId)
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
//         stats: {
//           max_speed: trip.max_speed || 0,
//           avg_speed: trip.avg_speed || 0,
//           total_distance: trip.total_distance || 0,
//           position_name: trip.position_name || null,
//           overspeed_count: trip.overspeed_count || 0,
//           geofence_crossing_count: trip.geofence_crossing_count || 0
//         }
//       }
//     });
//   } catch (err) {
//     console.error("[tripController] Error while fetching geometry:", err.message);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error"
//     });
//   }
// };


// // Fetch all trips by trip_approval_status = APPROVED/PENDING/CANCELLED
// // or by trip_dep_status = PENDING/APPROVED/CANCELLED

// exports.fetchTripsByStatus = async (req, res) => {
//   console.log('tripController: fetchTripsByStatus: req.query: ', req.query);

//   try {
//     const { trip_approval_status, trip_dep_status } = req.query;

//     // Build filter dynamically
//     const filter = {};
//     if (trip_approval_status && trip_dep_status) {
//       // Case 3: Both provided → AND condition
//       filter.trip_approval_status = trip_approval_status;
//       filter.trip_dep_status = trip_dep_status;
//     } else if (trip_approval_status) {
//       // Case 1: Only approval status
//       filter.trip_approval_status = trip_approval_status;
//     } else if (trip_dep_status) {
//       // Case 2: Only departure status
//       filter.trip_dep_status = trip_dep_status;
//     } else {
//       return res.status(404).json({
//         success: false,
//         message: "Provide trip_approval_status or trip_dep_status (or both) to filter assignments"
//       });
//     }

//     let assignments = [];
//     assignments = await Trip.find(filter)
//       .populate("route_id")
//       .populate("driver_id", "driver_name driver_license mobile_number")
//       .populate("vehicle_id", "registration_number make model")

//     console.log('tripController: fetchTripsByStatus trips: ', assignments);

//     if (!assignments || assignments.length === 0) {
//       return res.status(404).json({ success: false, message: "No assignments found" });
//     }

//     // Collect vehicle states
//     const vehicleIds = assignments.map(a => a.vehicle_id?._id || a.vehicle_id);
//     const vehicleStates = await VehicleState.find({ vehicle_id: { $in: vehicleIds } });

//     // Inl;ine function: Prepare JSON response data with inline mapping function
//     const json_response_data = assignments.map(a => ({
//       route: a.route_id
//         ? {
//           _id: a.route_id._id,
//           name: a.route_id.name,
//           place_from: a.route_id.place_from,
//           place_to: a.route_id.place_to,
//           source: a.route_id.source,
//           destination: a.route_id.destination,
//           geometry: a.route_id.geometry
//         }
//         : null,

//       assignment: {
//         _id: a._id,
//         route_id: a.route_id?._id || null,
//         vehicle_id: a.vehicle_id?._id || a.vehicle_id,
//         driver_id: a.driver_id ? a.driver_id._id : null,
//         departure_time: a.departure_time,
//         arrival_time: a.arrival_time,
//         assignment_desc: a.assignment_desc,
//         assigned_at: a.assigned_at,
//         status: a.status,
//         max_speed: a.max_speed || 0,
//         avg_speed: a.avg_speed || 0,
//         total_distance: a.total_distance || 0,
//         position_name: a.position_name || null,
//         overspeed_count: a.overspeed_count || 0,
//         geofence_crossing_count: a.geofence_crossing_count || 0,
//         trip_approval_status: a.trip_approval_status,
//         trip_dep_status: a.trip_dep_status,
//         trip_arrival_status: a.trip_arrival_status,
//         trip_actual_arrival_time: a.trip_actual_arrival_time,
//         trip_arrival_notes: a.trip_arrival_notes
//       },

//       vehicle: a.vehicle_id
//         ? {
//           id: a.vehicle_id._id,
//           registration_number: a.vehicle_id.registration_number,
//           make: a.vehicle_id.make,
//           model: a.vehicle_id.model
//         }
//         : null,

//       vehicleState: vehicleStates.find(
//         vs =>
//           vs.vehicle_id.toString() ===
//           (a.vehicle_id?._id?.toString() || a.vehicle_id.toString())
//       ),
//       driver: a.driver_id
//         ? {
//           id: a.driver_id._id || null,
//           driver_name: a.driver_id.driver_name || null,
//           driver_license: a.driver_id.driver_license || null,
//           driver_mobile: a.driver_id.mobile_number || null,
//         }
//         : null,
//     }));

//     res.status(200).json({
//       success: true,
//       message: "Assigned route(s) fetched successfully",
//       data: json_response_data
//     });
//   } catch (err) {
//     // await session.abortTransaction();
//     // session.endSession();

//     console.error("fetchAssignedRoute error:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

// // update trip_approval_status of an assigned route (trip)
// // PUT /trip/update-status
// exports.updateTripStatus = async (req, res) => {
//   console.log("tripController: updateTripStatus API called: req.params: ", req.params.tripId, " : req.body:", req.body);

//   const assignment_id = req.params.tripId;

//   console.log('tripController: updateTripStatus API: assignment_id: ', assignment_id);

//   const {
//     trip_approval_status,
//     trip_dep_status,
//     trip_arrival_status,
//     trip_actual_arrival_time,
//     trip_arrival_notes
//   } = req.body;

//   // Validate assignment_id
//   if (!assignment_id) {
//     return res.status(400).json({
//       success: false,
//       message: "Provide assignment_id in req.params to update!"
//     });
//   }

//   // Validate at least one status field
//   if (!trip_approval_status && !trip_dep_status && !trip_arrival_status) {
//     return res.status(400).json({
//       success: false,
//       message:
//         "Provide either trip_approval_status (APPROVED/CANCELLED) or trip_dep_status (DEPARTED/CANCELLED) or trip_arrival_status (INTIME/ONTIME/DELAYED)"
//     });
//   }

//   // Validate if trip_arrival_status = true and its value is not INTIME, DELAYED, ONTIME
//   // else check  trip_actual_arrival_time and trip_arrival_notes should not be empty
//   if (trip_arrival_status) {
//     if (trip_arrival_status != "INTIME" && trip_arrival_status != "ONTIME" && trip_arrival_status != "DELAYED") {
//       return res.status(404).json({
//         success: false,
//         message: "Check trip_arrival_status should be INTIME or ONTIME or DELAYED"
//       });
//     } else if (!trip_actual_arrival_time && !trip_arrival_notes) {
//       return res.status(404).json({
//         success: false,
//         message: "Check trip_actaul_arrival_time/trip_arrival_notes empty"
//       });
//     }
//   }

//   try {

//     //  Fetch trip by assignment_id
//     const trip = await Trip.findById(assignment_id);

//     if (!trip) {
//       return res.status(404).json({
//         success: false,
//         message: "No trip found to update status"
//       });
//     }

//     // Validation: departure status
//     if (trip_dep_status === "DEPARTED") {
//       if (trip.trip_approval_status !== "APPROVED") {
//         return res.status(403).json({
//           success: false,
//           message: "Forbidden: Trip is not approved."
//         });
//       }
//       if (!trip.driver_id) {
//         return res.status(403).json({
//           success: false,
//           message: "Forbidden: Driver is not mapped to the Vehicle."
//         });
//       }
//     }

//     // Validation: arrival status
//     if (
//       ["INTIME", "ONTIME", "DELAYED"].includes(trip_arrival_status)
//     ) {
//       if (trip.trip_approval_status !== "APPROVED") {
//         return res.status(403).json({
//           success: false,
//           message: "Forbidden: Trip is not approved."
//         });
//       }
//       if (trip.trip_dep_status !== "DEPARTED") {
//         return res.status(403).json({
//           success: false,
//           message: "Forbidden: Trip has not departed."
//         });
//       }
//     }

//     // Build update object dynamically
//     const updateFields = {};
//     if (trip_approval_status) updateFields.trip_approval_status = trip_approval_status;
//     if (trip_dep_status) updateFields.trip_dep_status = trip_dep_status;
//     if (trip_arrival_status) {
//       updateFields.trip_arrival_status = trip_arrival_status;
//       updateFields.status = 'INACTIVE';
//       if (trip_actual_arrival_time) {
//         updateFields.trip_actual_arrival_time = trip_actual_arrival_time;
//       };
//       if (trip_arrival_notes) {
//         updateFields.trip_arrival_notes = trip_arrival_notes;
//       }
//     }

//     // Handle cancellation: restore vehicle state
//     // If trip_approval_status = CANCELLED or trip_dep_status = CANCELLED  
//     // then restore the original status like place_of_availability and next_available_date
//     if (trip_approval_status === "CANCELLED" || trip_dep_status === "CANCELLED") {
//       try {
//         // Step 1: Fetch the vehicle state document by vehicle_id
//         const vs = await VehicleState.findById(trip.vehicle_id);

//         if (!vs) {
//           return res.status(404).json({
//             success: false,
//             message: "Vehicle state not found to restore"
//           });
//         }

//         // Step 2: Restore previous values safely
//         vs.place_of_availability = vs.prev_place_of_availability;
//         vs.next_available_date = vs.prev_available_date;

//         // Clear previous backup fields after restoration
//         vs.prev_place_of_availability = null;
//         vs.prev_available_date = null;

//         // Step 3: Save the updated state
//         await vs.save();

//       } catch (err) {
//         console.error("Error restoring vehicle state:", err.message);
//         return res.status(500).json({ success: false, message: err.message });
//       }
//     }

//     // Now update the trip schema  and finalize

//     const updatedTrip = await Trip.findByIdAndUpdate(
//       assignment_id,
//       updateFields,
//       { new: true, runValidators: true }
//     );

//     if (!updatedTrip) {
//       return res.status(404).json({
//         success: false,
//         message: "Trip not found, please retry"
//       });
//     }

//     // success response
//     res.json({
//       success: true,
//       message: "Trip status updated successfully",
//       data: updatedTrip
//     });
//     if (["INTIME", "ONTIME", "DELAYED"].includes(trip_arrival_status)) {
//       const result = migrateTripToHistory(assignment_id);
//       console.log(" [INFO] migrateTripToHistory result:", result);
//     }
//   } catch (err) {
//     console.error(" [ERROR] updateTripStatus failed:", err.message);
//     res.status(500).json({
//       success: false,
//       message: err.message
//     });
//   }
// };

// // --- end ---- 18/02/2026


// // Get all trips mapped to a Vehicle or Driver
// // Useful to fetch all trips carried out by a Vehicle or a Driver
// exports.getTripsByVehicleOrDriver = async (req, res) => {
//   console.log("tripController: getTripsByVehicleOrDriver API: req.query: ", req.query);

//   try {
//     const { vehicle_id, driver_id } = req.query;

//     const page = 1;
//     const limit = 10;

//     let query;

//     if (vehicle_id) {
//       query = {
//         vehicle_id: vehicle_id,
//         status: "ACTIVE",
//         trip_dep_status: "DEPARTED"
//       };
//     } else if (driver_id) {
//       query = {
//         driver_id: driver_id,
//         status: "ACTIVE",
//         trip_dep_status: "DEPARTED"
//       };
//     } else {
//       console.log("Provide either vehicle_id or driver_id to fetch Trips");

//       return res.status(400).json({
//         success: false,
//         message:
//           "Provide either vehicle_id or driver_id to fetch Trips"
//       });
//     }


//     // Get total count first 
//     const total = await Trip.countDocuments(query);


//     if (!total) {
//       return res
//         .status(404)
//         .json({ error: "No active Trips found for vehicle" });
//     }

//     // Fetch paginated results
//     const assignments = await Trip.find(query)
//       .populate("route_id", "name place_from place_to source destination")
//       .populate("vehicle_id", "registration_number make model")
//       .populate("driver_id", "driver_name mobile_number email_id")
//       .skip((page - 1) * limit)
//       .limit(parseInt(limit))
//       .lean(); // plain JS objects

//     const data = assignments.map(a => ({
//       _id: a._id,
//       vehicle_id: a.vehicle_id,
//       route_id: a.route_id,
//       driver_id: a.driver_id,
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

// // Below are initial PoC APIs, not used from 19th Feb version

// // Assign a vehicle to a route
// exports.assignVehicleToRoute = async (req, res) => {
//   try {
//     const { route_id, vehicle_id } = req.body;

//     // 1. Validate route exists
//     const route = await Route.findById(route_id);
//     if (!route) {
//       return res.status(404).json({ error: "Route not found" });
//     }

//     // 2. Validate vehicle exists
//     const vehicle = await Vehicle.findById(vehicle_id);
//     if (!vehicle) {
//       return res.status(404).json({ error: "Vehicle not found" });
//     }

//     // 3. Find the currently active driver for this vehicle
//     const driverAssignment = await DriverVehicleAssignment
//       .findOne({
//         vehicle_id,
//         status: "ACTIVE",
//       })
//       .populate("driver_id", "driver_name mobile_number email_id"); // optional populate for logging

//     let driver_id = null;
//     if (driverAssignment && driverAssignment.driver_id) {
//       driver_id = driverAssignment.driver_id._id;
//       console.log(
//         `[ASSIGN ROUTE] Vehicle ${vehicle_id} is assigned to driver:`,
//         driverAssignment.driver_id.driver_name,
//       );
//     } else {
//       console.warn(
//         `[WARN] No active driver found for vehicle ${vehicle_id} during route assignment`,
//       );
//       // You can decide:
//       //   - Allow assignment without driver (driver_id = null)
//       //   - OR block it: return res.status(400).json({ error: "No active driver assigned to this vehicle" });
//     }

//     // 4. Optional: Check if vehicle is already assigned to another active route
//     const existingAssignment = await Trip.findOne({
//       vehicle_id,
//       status: "ACTIVE",
//     });
//     if (existingAssignment) {
//       return res.status(409).json({
//         error: "This vehicle is already assigned to another active route",
//       });
//     }

//     // 5. Create the assignment
//     const assignment = new Trip({
//       route_id,
//       vehicle_id,
//       driver_id, // ← store the driver_id (null if no active driver)
//     });

//     await assignment.save();

//     // 6. Return populated response for frontend convenience
//     const populatedAssignment = await Trip.findById(
//       assignment._id,
//     )
//       .populate("route_id", "name source destination")
//       .populate("vehicle_id", "registration_number model")
//       .populate("driver_id", "driver_name mobile_number email_id");

//     res.status(201).json(populatedAssignment);
//   } catch (err) {
//     console.error("Error assigning vehicle to route:", err);
//     res.status(500).json({ error: err.message || "Internal server error" });
//   }
// };

// // Get all vehicles mapped to a route
// exports.getVehiclesByRoute = async (req, res) => {
//   try {
//     const { route_id } = req.params;
//     const assignments = await Trip.find({
//       route_id,
//       status: "ACTIVE",
//     }).populate("vehicle_id", "registration_number model driver_name");

//     res.json(assignments);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // Update vehicle-route assignment
// exports.updateTrip = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { vehicle_id, route_id } = req.body;

//     // Validate assignment exists
//     const assignment = await Trip.findById(id);
//     if (!assignment) {
//       return res.status(404).json({ message: "Assignment not found" });
//     }

//     // Validate route & vehicle
//     const route = await Route.findById(route_id);
//     const vehicle = await Vehicle.findById(vehicle_id);
//     if (!route || !vehicle) {
//       return res.status(404).json({ message: "Route or Vehicle not found" });
//     }

//     assignment.vehicle_id = vehicle_id;
//     assignment.route_id = route_id;

//     await assignment.save();

//     const updatedAssignment = await Trip.findById(id)
//       .populate("vehicle_id", "registration_number model driver_name")
//       .populate("route_id", "name source destination");

//     res.json(updatedAssignment);
//   } catch (err) {
//     console.error("Update assignment error:", err);
//     res.status(500).json({ message: err.message });
//   }
// };
