const Client = require('../models/client.model');
const Vehicle = require('../models/vehicle.js');
const GPSDevice = require('../models/gpsDevice');
const VehicleDeviceMap = require('../models/vehicleDeviceMap');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const logger = require('../utils/logger');

// Client CRUD
exports.getClients = async (req, res, next) => {
    try {
        const clients = await Client.find({ tenant_id: req.user.tenant_id });
        res.json(clients);
    } catch (err) {
        next(err);
    }
};

exports.createClient = async (req, res, next) => {
    try {
        const { password, ...clientData } = req.body;
        
        const client = new Client({
            ...clientData,
            tenant_id: req.user.tenant_id
        });
        await client.save();

        // If password is provided, create a User record for this client
        if (password) {
            const tenantUserRole = await Role.findOne({ name: 'tenant_user' });
            const newUser = new User({
                emp_id: `CL-${client._id.toString().slice(-6).toUpperCase()}`,
                email: client.email,
                password: password,
                role: tenantUserRole._id,
                tenant_id: req.user.tenant_id,
                client_id: client._id
            });
            await newUser.save();
            await logger.audit(req.user.emp_id, req.user.role, "create", "user", `Created user account for client ${client.entityName}`, "success", req.user.tenant_id, newUser._id);
        }

        await logger.audit(req.user.emp_id, req.user.role, "create", "client", `Created client ${client.entityName}`, "success", req.user.tenant_id, client._id);
        res.status(201).json(client);
    } catch (err) {
        next(err);
    }
};

exports.updateClient = async (req, res, next) => {
    try {
        const client = await Client.findOneAndUpdate(
            { _id: req.params.id, tenant_id: req.user.tenant_id },
            req.body,
            { new: true }
        );
        if (!client) return res.status(404).json({ error: "Client not found" });
        await logger.audit(req.user.emp_id, req.user.role, "update", "client", `Updated client ${client.entityName}`, "success", req.user.tenant_id, client._id);
        res.json(client);
    } catch (err) {
        next(err);
    }
};

exports.deleteClient = async (req, res, next) => {
    try {
        const client = await Client.findOneAndDelete({ _id: req.params.id, tenant_id: req.user.tenant_id });
        if (!client) return res.status(404).json({ error: "Client not found" });
        await logger.audit(req.user.emp_id, req.user.role, "delete", "client", `Deleted client ${client.entityName}`, "success", req.user.tenant_id, client._id);
        res.json({ message: "Client deleted successfully" });
    } catch (err) {
        next(err);
    }
};

// Vehicle CRUD
exports.getVehicles = async (req, res, next) => {
    try {
        const { client_id } = req.query;
        const query = { tenant_id: req.user.tenant_id };
        
        // If the user is a client (tenant_user), force filtering by their own client_id
        if (req.user.role === 'tenant_user') {
            query.client_id = req.user.client_id;
        } else if (client_id) {
            query.client_id = client_id;
        }
        
        const vehicles = await Vehicle.find(query).populate('client_id');
        res.json(vehicles);
    } catch (err) {
        next(err);
    }
};

exports.createVehicle = async (req, res, next) => {
    try {
        const vehicle = new Vehicle({
            ...req.body,
            tenant_id: req.user.tenant_id
        });
        await vehicle.save();
        await logger.audit(req.user.emp_id, req.user.role, "create", "vehicle", `Created vehicle ${vehicle.registration_number}`, "success", req.user.tenant_id, vehicle._id);
        res.status(201).json(vehicle);
    } catch (err) {
        next(err);
    }
};

exports.updateVehicle = async (req, res, next) => {
    try {
        const vehicle = await Vehicle.findOneAndUpdate(
            { _id: req.params.id, tenant_id: req.user.tenant_id },
            req.body,
            { new: true, runValidators: true }
        );
        if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
        await logger.audit(req.user.emp_id, req.user.role, "update", "vehicle", `Updated vehicle ${vehicle.registration_number}`, "success", req.user.tenant_id, vehicle._id);
        res.json(vehicle);
    } catch (err) {
        next(err);
    }
};

exports.deleteVehicle = async (req, res, next) => {
    try {
        const vehicle = await Vehicle.findOneAndDelete({ _id: req.params.id, tenant_id: req.user.tenant_id });
        if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
        await logger.audit(req.user.emp_id, req.user.role, "delete", "vehicle", `Deleted vehicle ${vehicle.registration_number}`, "success", req.user.tenant_id, vehicle._id);
        res.json({ message: "Vehicle deleted successfully" });
    } catch (err) {
        next(err);
    }
};

// GPS Device CRUD
exports.getGPSDevices = async (req, res, next) => {
    try {
        const query = { tenant_id: req.user.tenant_id };
        
        // If the user is a client (tenant_user), we might want to only show devices mapped to their vehicles
        // For now, let's keep it simple or restrict if necessary. 
        // Usually, clients only see vehicles. GPS devices are managed by Tenant Admin.
        if (req.user.role === 'tenant_user') {
            return res.status(403).json({ error: "Access denied: Client cannot manage GPS devices" });
        }

        const devices = await GPSDevice.find(query);
        res.json(devices);
    } catch (err) {
        next(err);
    }
};

exports.createGPSDevice = async (req, res, next) => {
    try {
        const device = new GPSDevice({
            ...req.body,
            tenant_id: req.user.tenant_id
        });
        await device.save();
        await logger.audit(req.user.emp_id, req.user.role, "create", "gps_device", `Created GPS device ${device.imei}`, "success", req.user.tenant_id, device._id);
        res.status(201).json(device);
    } catch (err) {
        next(err);
    }
};

exports.updateGPSDevice = async (req, res, next) => {
    try {
        const device = await GPSDevice.findOneAndUpdate(
            { _id: req.params.id, tenant_id: req.user.tenant_id },
            req.body,
            { new: true }
        );
        if (!device) return res.status(404).json({ error: "GPS Device not found" });
        await logger.audit(req.user.emp_id, req.user.role, "update", "gps_device", `Updated GPS device ${device.imei}`, "success", req.user.tenant_id, device._id);
        res.json(device);
    } catch (err) {
        next(err);
    }
};

exports.deleteGPSDevice = async (req, res, next) => {
    try {
        const device = await GPSDevice.findOneAndDelete({ _id: req.params.id, tenant_id: req.user.tenant_id });
        if (!device) return res.status(404).json({ error: "GPS Device not found" });
        await logger.audit(req.user.emp_id, req.user.role, "delete", "gps_device", `Deleted GPS device ${device.imei}`, "success", req.user.tenant_id, device._id);
        res.json({ message: "GPS Device deleted successfully" });
    } catch (err) {
        next(err);
    }
};

// Mapping
exports.mapDevice = async (req, res, next) => {
    const { vehicle_id, gps_device_id, installation_notes } = req.body;
    try {
        // Validate vehicle and device belong to tenant
        const vehicle = await Vehicle.findOne({ _id: vehicle_id, tenant_id: req.user.tenant_id });
        const device = await GPSDevice.findOne({ _id: gps_device_id, tenant_id: req.user.tenant_id });

        if (!vehicle || !device) {
            return res.status(404).json({ error: "Vehicle or GPS Device not found or not authorized" });
        }

        if (!device.canBeMapped()) {
            return res.status(400).json({ error: "GPS Device cannot be mapped (may be faulty or inactive)" });
        }

        const mapping = new VehicleDeviceMap({
            vehicle_id,
            gps_device_id,
            installation_notes,
            status: "MAPPED"
        });

        await mapping.save();
        await logger.audit(req.user.emp_id, req.user.role, "map", "vehicle_device", `Mapped device ${device.imei} to vehicle ${vehicle.registration_number}`, "success", req.user.tenant_id, mapping._id);
        res.status(201).json(mapping);
    } catch (err) {
        next(err);
    }
};

exports.unmapDevice = async (req, res, next) => {
    const { mapping_id } = req.body;
    try {
        const mapping = await VehicleDeviceMap.findById(mapping_id).populate('vehicle_id');
        if (!mapping) return res.status(404).json({ error: "Mapping not found" });

        // Verify ownership via vehicle
        const vehicle = await Vehicle.findOne({ _id: mapping.vehicle_id, tenant_id: req.user.tenant_id });
        if (!vehicle) return res.status(403).json({ error: "Unauthorized" });

        mapping.status = "UNMAPPED";
        mapping.unmapped_on = new Date();
        await mapping.save();
        await logger.audit(req.user.emp_id, req.user.role, "unmap", "vehicle_device", `Unmapped device from vehicle ${vehicle.registration_number}`, "success", req.user.tenant_id, mapping._id);
        res.json({ message: "Device unmapped successfully" });
    } catch (err) {
        next(err);
    }
};
