// /controllers/archiveController.js

/*
Manual endpoint (e.g. /archiveExpiredAssignments) so the users can trigger archival on demand, 
not just via cron

Combined Strategy
Cron job: Runs nightly at midnight to auto‑archive expired assignments.
Manual endpoint: Operators can trigger archival anytime via /api/archiveExpiredAssignments.

*/
const DriverVehicleAssignment = require("../models/driverVehicleAssignment");
const DriverVehicleAssignmentArchive = require("../models/driverVehicleAssignmentArchive");

exports.archiveExpiredAssignments = async (req, res) => {
  try {
    const now = new Date();

    // Find expired assignments
    const expiredAssignments = await DriverVehicleAssignment.find({
      to_datetime: { $lt: now },
      status: { $ne: "EXPIRED" }
    });

    if (!expiredAssignments || expiredAssignments.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No expired assignments found to archive"
      });
    }

    // Move to archive
    await DriverVehicleAssignmentArchive.insertMany(
      expiredAssignments.map(a => ({
        driver_id: a.driver_id,
        vehicle_id: a.vehicle_id,
        route_id: a.route_id,
        from_datetime: a.from_datetime,
        to_datetime: a.to_datetime,
        instructions: a.instructions,
        status: "EXPIRED",
        archived_at: new Date()
      }))
    );

    // Delete from active collection
    await DriverVehicleAssignment.deleteMany({
      _id: { $in: expiredAssignments.map(a => a._id) }
    });

    res.status(200).json({
      success: true,
      message: `Archived ${expiredAssignments.length} expired assignments`,
      archivedCount: expiredAssignments.length
    });
  } catch (err) {
    console.error("archiveExpiredAssignments error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};


/*
Archive documents Query endpoint (e.g. /api/archivedAssignments) so operators can list and 
filter archived records by driver, vehicle, or date range

GET /api/archivedAssignments?driver_id=67b5555555abcdef012345678&from_date=2026-02-01&to_date=2026-02-20

Response:

{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "67b9999999abcdef012345678",
      "driver_id": {
        "_id": "67b5555555abcdef012345678",
        "name": "Ramesh Kumar",
        "license_number": "DL1234567890"
      },
      "vehicle_id": {
        "_id": "67b456789abcdef012345678",
        "registration_number": "UP16AB1234",
        "make": "Tata",
        "model": "Ace"
      },
      "route_id": {
        "_id": "67b123e4f9a8c2d345678901",
        "name": "Delhi Railway Station → Noida Sector 18",
        "place_from": "Delhi Railway Station",
        "place_to": "Noida Sector 18"
      },
      "from_datetime": "2026-02-18T09:00:00.000Z",
      "to_datetime": "2026-02-18T11:00:00.000Z",
      "instructions": "Morning shuttle",
      "status": "EXPIRED",
      "archived_at": "2026-02-19T00:00:00.000Z"
    }
  ]
}

Archival Logic:

Cron job: auto‑archives expired assignments nightly.
Manual endpoint: /api/archiveExpiredAssignments to trigger archival on demand.
Query endpoint: /api/archivedAssignments to list and filter archived records by driver, vehicle, or date range.

*/
// =======================================
// LIST Archived Assignments
// =======================================
exports.getArchivedAssignments = async (req, res) => {
  try {
    const { driver_id, vehicle_id, from_date, to_date } = req.query;

    const filter = {};

    if (driver_id) filter.driver_id = driver_id;
    if (vehicle_id) filter.vehicle_id = vehicle_id;

    if (from_date && to_date) {
      filter.to_datetime = {
        $gte: new Date(from_date),
        $lte: new Date(to_date)
      };
    } else if (from_date) {
      filter.to_datetime = { $gte: new Date(from_date) };
    } else if (to_date) {
      filter.to_datetime = { $lte: new Date(to_date) };
    }

    const archivedAssignments = await DriverVehicleAssignmentArchive.find(filter)
      .populate("driver_id", "name license_number")
      .populate("vehicle_id", "registration_number make model")
      .populate("route_id", "name place_from place_to");

    res.status(200).json({
      success: true,
      count: archivedAssignments.length,
      data: archivedAssignments
    });
  } catch (err) {
    console.error("getArchivedAssignments error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

