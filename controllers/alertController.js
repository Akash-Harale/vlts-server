const Alert = require("../models/alert.model");

const { getGpsDeviceIdByVehicleId } = require("../utils/getGpsDeviceIdByVehicleId");

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
        console.log("gps_device_id", gps_device_id);
        const allAlerts = await Alert.find({
            gps_id: gps_device_id,
            client_id: req.user.client_profile_id
        });
        const count = allAlerts.length;
        if (!count) {
            return res.status(200).json({
                message: "No alerts found",
            })
        }
        res.status(200).json({
            message: `All alerts fetched successfully with count ${count}`,
            allAlerts
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
        if (!status) {
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
        if (!tamper_alert) {
            return res.status(400).json({
                message: "Tamper alert is required",
            })
        }
        if (!fuel_alert) {
            return res.status(400).json({
                message: "Fuel alert is required",
            })
        }
        if (!movement_alert) {
            return res.status(400).json({
                message: "Movement alert is required",
            })
        }
        if (!ignition_alert) {
            return res.status(400).json({
                message: "Ignition alert is required",
            })
        }

        const newAlert = new Alert({
            client_id,
            vehicle_id,
            gps_id:gps_device_id,
            alert_type,
            status,
            day,
            start_time,
            end_time,
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
        res.status(500).json({
            message: "Error creating alert",
            error
        })
    }
}

const updateAlert = async (req, res) => {
    try {
        const alert = await Alert.findById(req.params.id);
        if (!alert) {
            return res.status(404).json({
                message: "Alert not found",
            })
        }
        const updatedAlert = await Alert.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({
            message: "Alert updated successfully",
            alert: updatedAlert
        })
    } catch (error) {
        res.status(500).json({
            message: "Error updating alert",
            error
        })
    }
}

// find all alerts of client by gps_id and then mark the status of all true/false
const updateAllAlerts = async (req, res) => {
    try {
        const alerts = await Alert.find({ gps_id: req.params.gps_id });
        if (!alerts) {
            return res.status(404).json({
                message: "Alerts not found",
            })
        }
        const updatedAlerts = await Alert.updateMany({ gps_id: req.params.gps_id }, { status: req.body.status });
        res.status(200).json({
            message: "Alerts updated successfully",
            alerts: updatedAlerts
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
