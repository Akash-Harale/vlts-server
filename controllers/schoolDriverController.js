const DriverVehicleAssignment = require("../models/driverVehicleAssignment");

const getAssignedVehicle = async (req, res) => {
    try {
        const { client_profile_id: client_id, id: driver_id } = req.user;

        if (!client_id || !driver_id) {
            return res.status(400).json({
                success: false,
                message: "Client ID or Driver ID is missing"
            });
        }

        const vehicles = await DriverVehicleAssignment.find({
            client_id,
            driver_id
        }).lean();

        if (vehicles.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No vehicle assigned to this driver"
            });
        }

        return res.status(200).json({
            success: true,
            data: vehicles
        });

    } catch (error) {
        console.error("Error fetching assigned vehicle:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    getAssignedVehicle
};
