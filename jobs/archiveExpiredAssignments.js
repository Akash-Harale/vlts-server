// Date 23/02/2026
// Author : Suresh Gupta
// /jobs/archiveExpiredAssignments.js

/*
How It Works
Runs every day at midnight (0 0 * * *).
Finds expired assignments (to_datetime < now).
Copies them into DriverVehicleAssignmentArchive.
Deletes them from the active collection.
Marks them as EXPIRED in the archive.

Example Archived Document

{
  "_id": "67b9999999abcdef012345678",
  "driver_id": "67b5555555abcdef012345678",
  "vehicle_id": "67b456789abcdef012345678",
  "route_id": "67b123e4f9a8c2d345678901",
  "from_datetime": "2026-02-18T09:00:00.000Z",
  "to_datetime": "2026-02-18T11:00:00.000Z",
  "instructions": "Morning shuttle",
  "status": "EXPIRED",
  "archived_at": "2026-02-19T00:00:00.000Z"
}

With this setup, expired assignments are automatically archived and 
removed from the active collection, keeping your data clean and audit‑safe.

*/
const cron = require("node-cron");
const DriverVehicleAssignment = require("../models/driverVehicleAssignment");
const DriverVehicleAssignmentArchive = require("../models/driverVehicleAssignmentArchive");

cron.schedule("0 0 * * *", async () => {
  console.log("Running expired assignment archival job...");

  try {
    const now = new Date();

    // Find expired assignments
    const expiredAssignments = await DriverVehicleAssignment.find({
      to_datetime: { $lt: now },
      status: { $ne: "EXPIRED" }
    });

    if (expiredAssignments.length > 0) {
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

      console.log(`Archived ${expiredAssignments.length} expired assignments.`);
    } else {
      console.log("No expired assignments found.");
    }
  } catch (err) {
    console.error("Error archiving expired assignments:", err);
  }
});


