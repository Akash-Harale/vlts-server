const GpsAllocation = require("../models/GpsAllocation");

const allocateGpsToTechnician = async (req, res) => {
    try {
        const { technicianId, gpsId } = req.body;


        if (!technicianId || !gpsId) {
            return res.status(400).json({ success: false, error: "Please provide technicianId and gpsId" });
        }

        const allocation = new GpsAllocation({ technicianId, gpsId });

        await allocation.save();
        res.json({ success: true, allocation });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};


const allocateGpsToSalesPerson = async (req, res) => {
    try {
        const { salespersonId, gpsId } = req.body;


        if (!salespersonId || !gpsId) {
            return res.status(400).json({ success: false, error: "Please provide salespersonId and gpsId" });
        }

        const allocation = new GpsAllocation({ salespersonId, gpsId });

        await allocation.save();
        res.json({ success: true, allocation });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    allocateGpsToTechnician,
    allocateGpsToSalesPerson
};
