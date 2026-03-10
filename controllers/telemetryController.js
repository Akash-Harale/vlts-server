const Telemetry = require("../models/telemetry");

// Get telemetry with filters
exports.getTelemetry = async (req, res) => {
    try {
        const { vehicleId, tripId, startDate, endDate } = req.query;
        const filter = {};
        if (vehicleId) filter.vehicle_id = vehicleId;
        if (tripId) filter.trip_id = tripId;
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }

        const telemetry = await Telemetry.find(filter)
            .sort({ timestamp: -1 })
            .limit(500) // safety limit
            .populate("vehicle_id driver_id route_id trip_id");

        res.json(telemetry);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch telemetry", details: err.message });
    }
};

// Get single telemetry record
exports.getTelemetryById = async (req, res) => {
    try {
        const telemetry = await Telemetry.findById(req.params.id)
            .populate("vehicle_id driver_id route_id trip_id");
        if (!telemetry) return res.status(404).json({ error: "Telemetry not found" });
        res.json(telemetry);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch telemetry", details: err.message });
    }
};

// Delete telemetry record
exports.deleteTelemetry = async (req, res) => {
    try {
        const result = await Telemetry.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ error: "Telemetry not found" });
        res.json({ message: "Telemetry deleted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete telemetry", details: err.message });
    }
};

