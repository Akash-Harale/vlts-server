const Client = require("../models/client.model");

/**
 * CREATE client
 */
exports.createClient = async (req, res) => {
    try {
        const client = await Client.create(req.body);
        res.status(201).json({
            success: true,
            message: "Client created successfully",
            data: client,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * GET all clients
 */
exports.getAllClients = async (req, res) => {
    try {
        const clients = await Client.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: clients,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * GET single client by ID
 */
exports.getClientById = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);

        if (!client) {
            return res.status(404).json({
                success: false,
                message: "Client not found",
            });
        }

        res.status(200).json({
            success: true,
            data: client,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * UPDATE client
 */
exports.updateClient = async (req, res) => {
    try {
        const client = await Client.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!client) {
            return res.status(404).json({
                success: false,
                message: "Client not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Client updated successfully",
            data: client,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * DELETE client
 */
exports.deleteClient = async (req, res) => {
    try {
        const client = await Client.findByIdAndDelete(req.params.id);

        if (!client) {
            return res.status(404).json({
                success: false,
                message: "Client not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Client deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
