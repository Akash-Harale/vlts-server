const GpsAlert = require("../models/gpsAlert");

// Get all alerts with filters
exports.getAlerts = async (req, res) => {
    try {
        const { type, severity, acknowledged } = req.query;
        const filter = {};
        if (type) filter.type = type;
        if (severity) filter.severity = severity;
        if (acknowledged !== undefined) filter.acknowledged = acknowledged === "true";

        const alerts = await GpsAlert.find(filter)
            .sort({ timestamp: -1 })
            .populate("vehicle_id telemetry_id");

        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch alerts", details: err.message });
    }
};

// Get single alert
exports.getAlertById = async (req, res) => {
    try {
        const alert = await GpsAlert.findById(req.params.id).populate("vehicle_id telemetry_id");
        if (!alert) return res.status(404).json({ error: "Alert not found" });
        res.json(alert);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch alert", details: err.message });
    }
};

// Acknowledge alert
exports.acknowledgeAlert = async (req, res) => {
    try {
        const alert = await GpsAlert.findByIdAndUpdate(
            req.params.id,
            { acknowledged: true },
            { new: true }
        );
        if (!alert) return res.status(404).json({ error: "Alert not found" });
        res.json({ message: "Alert acknowledged", alert });
    } catch (err) {
        res.status(500).json({ error: "Failed to acknowledge alert", details: err.message });
    }
};

// Delete alert
exports.deleteAlert = async (req, res) => {
    try {
        const result = await GpsAlert.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ error: "Alert not found" });
        res.json({ message: "Alert deleted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete alert", details: err.message });
    }
};
