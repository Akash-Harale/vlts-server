
// /routes/archiveRoutes.js
const express = require("express");
const router = express.Router();
const { archiveExpiredAssignments, getArchivedAssignments } = require("../controllers/archiveController");

// Manual trigger endpoint
/* POST /api/archiveExpiredAssignments
 {
  "success": true,
  "message": "Archived 3 expired assignments",
  "archivedCount": 3
}

*/
router.post("/archiveExpiredAssignments", archiveExpiredAssignments);

// Query archived assignments
/*GET /api/archivedAssignments?driver_id=67b5555555abcdef012345678&from_date=2026-02-01&to_date=2026-02-20

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

*/
router.get("/archivedAssignments", getArchivedAssignments);

module.exports = router;
