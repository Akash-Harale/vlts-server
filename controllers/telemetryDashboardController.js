const Telemetry = require("../models/telemetry");
const turf = require("@turf/turf");

exports.getDashboardStats = async (req, res) => {
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

        if (!telemetry.length) {
            return res.json({ vehicleId, date, stats: "No telemetry data available" });
        }

        // Distance travelled
        let distance = 0;
        for (let i = 1; i < telemetry.length; i++) {
            const prev = telemetry[i - 1].location.coordinates;
            const curr = telemetry[i].location.coordinates;
            const from = { type: "Point", coordinates: prev };
            const to = { type: "Point", coordinates: curr };
            distance += turf.distance(from, to, { units: "kilometers" });
        }

        // Average speed
        const avgSpeed =
            telemetry.reduce((sum, t) => sum + (t.speed || 0), 0) / telemetry.length;

        // Idle time (speed <= 5)
        const idleRecords = telemetry.filter((t) => t.speed <= 5).length;
        const idleMinutes = idleRecords * 2 / 60; // assuming 2s poll interval → convert to minutes

        // Overspeed count
        const overspeedLimit = process.env.OVERSPEED_LIMIT || 80;
        const overspeedCount = telemetry.filter((t) => t.speed > overspeedLimit).length;

        res.json({
            vehicleId,
            date,
            distanceKm: distance.toFixed(2),
            averageSpeed: avgSpeed.toFixed(2),
            idleMinutes: idleMinutes.toFixed(2),
            overspeedLimit,
            overspeedCount
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to calculate dashboard stats", details: err.message });
    }
};
