const VehicleDeviceMap = require("../models/vehicleDeviceMap");

const getGpsDeviceIdByVehicleId = async (vehicle_id) => {
    if (!vehicle_id) {
        throw new Error("Vehicle ID is required");
    }
    try {
        const vehicleDeviceMap = await VehicleDeviceMap.findOne({ vehicle_id });
        if (!vehicleDeviceMap) {
            return null;
        }
        return vehicleDeviceMap.gps_device_id;
    } catch (error) {
        console.error("Error fetching GPS device ID by vehicle ID:", error);
        return null;
    }
}

module.exports = { getGpsDeviceIdByVehicleId }