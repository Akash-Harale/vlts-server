const Telemetry = require("../models/telemetry");

// Daily distance travelled per vehicle
exports.getDailyDistance = async (req, res) => {
    try {
        const { vehicleId, date } = req.query;
        if (!vehicleId || !date) {
            return res.status(400).json({ error: "vehicleId and date are required" });
        }

        const start = new Date(date);
        const end = new Date(date);
        end.setDate(end.getDate() + 1);

        const telemetry = await Telemetry.find({
            vehicle_id: vehicleId,
            timestamp: { $gte: start, $lt: end }
        }).sort({ timestamp: 1 });

        let distance = 0;
        for (let i = 1; i < telemetry.length; i++) {
            const prev = telemetry[i - 1].location.coordinates;
            const curr = telemetry[i].location.coordinates;
            // Haversine formula via Turf.js
            const from = { type: "Point", coordinates: prev };
            const to = { type: "Point", coordinates: curr };
            distance += require("@turf/distance")(from, to, { units: "kilometers" });
        }

        res.json({ vehicleId, date, distanceKm: distance.toFixed(2) });
    } catch (err) {
        res.status(500).json({ error: "Failed to calculate distance", details: err.message });
    }
};

// Average speed
exports.getAverageSpeed = async (req, res) => {
    try {
        const { vehicleId, startDate, endDate } = req.query;
        if (!vehicleId) return res.status(400).json({ error: "vehicleId is required" });

        const filter = { vehicle_id: vehicleId };
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }

        const result = await Telemetry.aggregate([
            { $match: filter },
            { $group: { _id: null, avgSpeed: { $avg: "$speed" } } }
        ]);

        res.json({ vehicleId, averageSpeed: result[0]?.avgSpeed || 0 });
    } catch (err) {
        res.status(500).json({ error: "Failed to calculate average speed", details: err.message });
    }
};

// Idle time (speed <= 5)
exports.getIdleTime = async (req, res) => {
    try {
        const { vehicleId, startDate, endDate } = req.query;
        if (!vehicleId) return res.status(400).json({ error: "vehicleId is required" });

        const filter = { vehicle_id: vehicleId, speed: { $lte: 5 } };
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }

        const telemetry = await Telemetry.find(filter).sort({ timestamp: 1 });
        let idleMinutes = telemetry.length * 2; // assuming 2s poll interval → ~2s per record
        res.json({ vehicleId, idleMinutes });
    } catch (err) {
        res.status(500).json({ error: "Failed to calculate idle time", details: err.message });
    }
};

// Overspeed count
exports.getOverspeedCount = async (req, res) => {
    try {
        const { vehicleId, limit } = req.query;
        const overspeedLimit = limit || process.env.OVERSPEED_LIMIT || 80;

        const count = await Telemetry.countDocuments({
            vehicle_id: vehicleId,
            speed: { $gt: overspeedLimit }
        });

        res.json({ vehicleId, overspeedLimit, overspeedCount: count });
    } catch (err) {
        res.status(500).json({ error: "Failed to calculate overspeed count", details: err.message });
    }
};

