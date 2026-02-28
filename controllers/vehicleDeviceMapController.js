// controllers/vehicleDeviceMapController.js
// Handles mapping GPS devices to vehicles with debug logs

const GPSDevice = require("../models/gpsDevice");
const VehicleDeviceMap = require("../models/vehicleDeviceMap");

// POST /vehicle-device-map/:vehicleId/map-device/:deviceId
// → Map a GPS device to a vehicle

// Assuming route is something like: POST /api/assignments/map or POST /api/gps/assign
exports.mapDevice = async (req, res) => {
  console.log(
    "[DEBUG] Attempting to map device:",
    req.body.gps_id,
    "to vehicle:",
    req.body.vehicle_id,
  );

  try {
    const { gps_device_id, vehicle_id, technician_id, installation_date, installation_notes } =
      req.body;

    if (!gps_device_id || !vehicle_id) {
      return res
        .status(400)
        .json({ error: "Both gps_device_id and vehicle_id are required" });
    }

    const device = await GPSDevice.findById(gps_device_id);
    if (!device) {
      console.warn("[WARN] GPS Device not found:", gps_device_id);
      return res.status(404).json({ error: "GPS Device not found" });
    }

    // Validation: only ACTIVE devices can be mapped
    if (!device.canBeMapped()) {
      device.failed_attempts += 1;
      await device.save(); // may auto-mark as FAULTY
      return res.status(400).json({
        error: `Device ${device.serial_number || device.imei} is ${device.status} and cannot be mapped`,
      });
    }

    // Optional: check if device is already mapped (prevents duplicates)
    const existing = await VehicleDeviceMap.findOne({ gps_device_id });
    if (existing && existing.status === 'MAPPED') {
      return res.status(409).json({
        error: "This GPS device is already assigned to another vehicle",
      });
    }

    const mapping = new VehicleDeviceMap({
      vehicle_id,
      gps_device_id,
      technician_id,
      installation_date,
      installation_notes
    });

    await mapping.save();
    console.log("[DEBUG] Mapping saved:", mapping._id);

    res.status(201).json(mapping);
  } catch (err) {
    console.error("[ERROR] MapDevice failed:", err.message);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};
// GET /vehicle-device-map/all
// → View all mapped GPS devices with vehicles
exports.getAllGPSAssignedVehicle = async (req, res) => {
  console.log(" [DEBUG] Fetching all mapped GPS devices with vehicles");
  try {
    const gpsAssignedVehicles = await VehicleDeviceMap.find({
      status: "MAPPED",
    })
      .populate("gps_device_id")
      .populate("vehicle_id");

    if (!gpsAssignedVehicles || gpsAssignedVehicles.length === 0) {
      console.warn(" [WARN] No mapped devices found");
      return res.status(404).json([]);
    }

    console.log(" [DEBUG] Total mappings found:", gpsAssignedVehicles.length);

    // Always return as array
    res.json(gpsAssignedVehicles);
  } catch (err) {
    console.error(" [ERROR] GetAllGPSAssignedVehicle failed:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /vehicle-device-map/:id/device
// → View mapped GPS device for a vehicle OR by deviceId
exports.getMappedDevice = async (req, res) => {
  const { id } = req.params;
  console.log(" [DEBUG] Fetching mapped device for ID:", id);

  try {
    // Try lookup by vehicle_id first
    let mapping = await VehicleDeviceMap.findOne({
      vehicle_id: id,
      status: "MAPPED",
    })
      .populate("gps_device_id")
      .populate("vehicle_id");

    // If not found, fallback to lookup by gps_device_id
    if (!mapping) {
      mapping = await VehicleDeviceMap.findOne({
        gps_device_id: id,
        status: "MAPPED",
      })
        .populate("gps_device_id")
        .populate("vehicle_id");
    }

    if (!mapping) {
      console.warn(" [WARN] No mapped device found for ID:", id);
      return res.status(404).json([]);
    }

    console.log(" [DEBUG] Mapping found:", {
      mapping_id: mapping._id,
      vehicle_id: mapping.vehicle_id?._id,
      gps_device_id: mapping.gps_device_id?._id,
      status: mapping.status,
    });

    // Wrap single mapping in array for consistency
    res.json([mapping]);
  } catch (err) {
    console.error(" [ERROR] GetMappedDevice failed:", err.message);
    res.status(500).json({ error: err.message });
  }
};


// PUT /vehicle-device-map/map-device/:deviceId
// → Replace GPS device mapping for a vehicle
exports.updateMapping = async (req, res) => {
  const { deviceId } = req.params;
  const { vehicle_id, technician_id, installation_date, installation_notes } = req.body;

  console.log(" [DEBUG] Updating mapping: replacing device:", deviceId, "for vehicle:", vehicle_id);

  try {
    // Step 1: Unmap any existing mapping for this vehicle
    await VehicleDeviceMap.updateMany(
      { vehicle_id, status: "MAPPED" },
      { status: "UNMAPPED", unmapped_on: new Date() }
    );

    // Step 2: Unmap this device if it was mapped elsewhere
    await VehicleDeviceMap.updateMany(
      { gps_device_id: deviceId, status: "MAPPED" },
      { status: "UNMAPPED", unmapped_on: new Date() }
    );

    // Step 3: Create or update mapping with new device
    let mapping = await VehicleDeviceMap.findOneAndUpdate(
      { vehicle_id, gps_device_id: deviceId },
      {
        vehicle_id,
        gps_device_id: deviceId,
        technician_id,
        installation_date,
        installation_notes,
        status: "MAPPED",
      },
      { upsert: true, new: true }
    )
      .populate("gps_device_id")
      .populate("vehicle_id");

    if (!mapping) {
      console.warn(" [WARN] Mapping update failed for vehicle:", vehicle_id);
      return res.status(404).json([]);
    }

    console.log(" [DEBUG] Mapping updated:", {
      mapping_id: mapping._id,
      vehicle_id: mapping.vehicle_id?._id,
      gps_device_id: mapping.gps_device_id?._id,
      status: mapping.status,
    });

    // Wrap in array for consistency
    res.json([mapping]);
  } catch (err) {
    console.error(" [ERROR] UpdateMapping failed:", err.message);
    res.status(400).json({ error: err.message });
  }
};


// DELETE /vehicle-device-map/map-device/:deviceId
// → Remove GPS device mapping (vehicleId auto-resolved)
exports.removeMapping = async (req, res) => {
  const { deviceId } = req.params;
  console.log(" [DEBUG] Removing mapping for device:", deviceId);

  try {
    const mapping = await VehicleDeviceMap.findOneAndUpdate(
      {
        gps_device_id: deviceId,
        status: "MAPPED",
      },
      { status: "UNMAPPED", unmapped_on: new Date() },
      { new: true }
    )
      .populate("gps_device_id")
      .populate("vehicle_id");

    if (!mapping) {
      console.warn(" [WARN] Mapping not found for removal:", deviceId);
      return res.status(404).json([]);
    }

    console.log(" [DEBUG] Mapping removed:", {
      mapping_id: mapping._id,
      vehicle_id: mapping.vehicle_id?._id,
      gps_device_id: mapping.gps_device_id?._id,
      status: mapping.status,
    });

    // Return as array for consistency with other APIs
    res.json([mapping]);
  } catch (err) {
    console.error(" [ERROR] RemoveMapping failed:", err.message);
    res.status(500).json({ error: err.message });
  }
};

