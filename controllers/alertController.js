const Alert = require("../models/alert.model");
const { getGpsDeviceIdByVehicleId } = require("../utils/getGpsDeviceIdByVehicleId");
const { parseAlertDateTime, formatAlertDateTime } = require("../utils/alertTimeUtils");

// you will get vehicle id from params, get tha vehicle and find the gps id from the vehicle-gps mapping collection and then find alert by gps id.

const getAllAlerts = async (req, res) => {
    console.log("req.user", req.user.client_profile_id);
    try {
        const { vehicle_id } = req.params;

        if (!vehicle_id) {
            return res.status(400).json({
                message: "Vehicle ID is required",
            })
        }
        const gps_device_id = await getGpsDeviceIdByVehicleId(vehicle_id);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const allAlerts = await Alert.find({
            gps_id: gps_device_id,
            client_id: req.user.client_profile_id,
            end_time: { $gte: oneDayAgo }  // end_time >= 1 day ago (includes future)
        }).sort({ end_time: 1 });
        const count = allAlerts.length;
        if (!count) {
            return res.status(200).json({
                message: "No alerts found",
            })
        }

        // Format start_time & end_time from UTC → IST 12-hour string for response
        const formattedAlerts = allAlerts.map((alert) => {
            const obj = alert.toObject();
            return {
                ...obj,
                start_time: formatAlertDateTime(obj.start_time),  // e.g. "08:30 AM"
                end_time: formatAlertDateTime(obj.end_time),    // e.g. "06:45 PM"
            };
        });

        res.status(200).json({
            message: `All alerts fetched successfully with count ${count}`,
            allAlerts: formattedAlerts
        })
    } catch (error) {
        res.status(500).json({
            message: "Error fetching all alerts",
            error
        })
    }
}

const createAlert = async (req, res) => {
    const client_id = req.user.client_profile_id;

    try {
        const { vehicle_id } = req.params;
        const { alert_type, status, day, start_time, end_time, location, radius, tamper_alert, fuel_alert, movement_alert, ignition_alert } = req.body;

        const gps_device_id = await getGpsDeviceIdByVehicleId(vehicle_id);

        if (!client_id) {
            return res.status(400).json({
                message: "Client ID is required",
            })
        }
        if (!vehicle_id) {
            return res.status(400).json({
                message: "Vehicle ID is required",
            })
        }
        if (!gps_device_id) {
            return res.status(400).json({
                message: "GPS Device ID is required",
            })
        }
        if (!alert_type) {
            return res.status(400).json({
                message: "Alert type is required",
            })
        }
        if (status === undefined || status === null) {
            return res.status(400).json({
                message: "Status is required",
            })
        }
        if (!day) {
            return res.status(400).json({
                message: "Day is required",
            })
        }
        if (!start_time) {
            return res.status(400).json({
                message: "Start time is required",
            })
        }
        if (!end_time) {
            return res.status(400).json({
                message: "End time is required",
            })
        }
        if (!location) {
            return res.status(400).json({
                message: "Location is required",
            })
        }
        if (!radius) {
            return res.status(400).json({
                message: "Radius is required",
            })
        }
        if (tamper_alert === undefined || tamper_alert === null) {
            return res.status(400).json({
                message: "Tamper alert is required",
            })
        }
        if (fuel_alert === undefined || fuel_alert === null) {
            return res.status(400).json({
                message: "Fuel alert is required",
            })
        }
        if (movement_alert === undefined || movement_alert === null) {
            return res.status(400).json({
                message: "Movement alert is required",
            })
        }
        if (ignition_alert === undefined || ignition_alert === null) {
            return res.status(400).json({
                message: "Ignition alert is required",
            })
        }

        const newAlert = new Alert({
            client_id,
            vehicle_id,
            gps_id: gps_device_id,
            alert_type,
            status,
            day,
            start_time: parseAlertDateTime(start_time),  // "08:30 AM" → UTC Date
            end_time: parseAlertDateTime(end_time),     // "06:45 PM" → UTC Date
            location,
            radius,
            tamper_alert,
            fuel_alert,
            movement_alert,
            ignition_alert
        });
        const savedAlert = await newAlert.save();
        res.status(201).json({
            message: "Alert created successfully",
            alert: savedAlert
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Error creating alert",
            error: error.message,
            stack: error.stack
        });
    }
}

const updateAlert = async (req, res) => {
    try {
        const alert = await Alert.findById(req.params.id);

        if (!alert) {
            return res.status(404).json({
                message: "Alert not found",
            });
        }

        const updateData = { ...req.body };

        // Parse date-time strings if provided
        if (updateData.start_time) {
            updateData.start_time = parseAlertDateTime(updateData.start_time);
        }

        if (updateData.end_time) {
            updateData.end_time = parseAlertDateTime(updateData.end_time);
        }

        const updatedAlert = await Alert.findByIdAndUpdate(
            req.params.id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        const formattedAlert = {
            ...updatedAlert.toObject(),
            start_time: formatAlertDateTime(updatedAlert.start_time),
            end_time: formatAlertDateTime(updatedAlert.end_time)
        };

        res.status(200).json({
            message: "Alert updated successfully",
            alert: formattedAlert
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Error updating alert",
            error: error.message
        });
    }
};

// find all alerts of client by gps_id and then mark the status of all true/false
const updateAllAlerts = async (req, res) => {
    try {
        const gps_id = await getGpsDeviceIdByVehicleId(req.params.vehicle_id);
        if (!gps_id) {
            return res.status(404).json({
                message: "GPS device ID not found",
            })
        }
        const alerts = await Alert.find({ gps_id: gps_id });
        if (!alerts) {
            return res.status(404).json({
                message: "Alerts not found",
            })
        }
        const updatedAlerts = await Alert.updateMany({ gps_id: gps_id }, { status: req.body.status });
        res.status(200).json({
            message: "Alerts updated successfully",
        })
    } catch (error) {
        res.status(500).json({
            message: "Error updating alerts",
            error
        })
    }
}

const deleteAlert = async (req, res) => {
    res.json({
        message: "Alert deleted successfully",
        alert: {}
    })
}

const deleteAllAlerts = async (req, res) => {
    res.json({
        message: "All alerts deleted successfully",
        alerts: []
    })
}

module.exports = {
    getAllAlerts,
    createAlert,
    updateAlert,
    updateAllAlerts,
    deleteAlert,
    deleteAllAlerts,
}
