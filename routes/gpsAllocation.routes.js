const express = require("express");
const { allocateGpsToTechnician, allocateGpsToSalesPerson } = require("../controllers/gpsAllocation.controller");
const router = express.Router();

// Allocate GPS to Technician
router.post("/technician", allocateGpsToTechnician);

// Allocate GPS to Sales Person
router.post("/salesperson", allocateGpsToSalesPerson);

// Unallocate GPS from Technician
// router.post("/unallocate", unallocateGpsFromTechnician);
// // Get all allocated GPS to Technician
// router.get("/allocation/:technicianId", getAllocatedGps);
// // Get all allocations by GPS ID
// router.get("/allocationbygps/:gpsId", getAllocationsByGps);


module.exports = router;