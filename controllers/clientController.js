// controllers/tenantClientController.js   -- Access by Tenant Admin Only

// Purpose: Tenant Admin manages client profiles (CRUD)
// 23/03/2026
/*
Create/Read/Update/Delete client profiles → allowed only for roles with "manage_clients".
Delete client → blocked if client has users, to prevent orphaned users.
Audit logs → record all actions.

Benefits
Matches “clean before delete” lifecycle.
RBAC enforced via "manage_clients".
Prevents orphaned client users.
Clear API responses for frontend.

*/
require('dotenv').config(); // Ensure this is at the top
const mongoose = require('mongoose');
const Client = require("../models/client.model");
const User = require('../models/userModel');
const Employee = require('../models/employeeModel');
const Role = require('../models/roleModel');
const logger = require('../utils/logger');

/**
 * Create a new client profile
 */
exports.createClient = async (req, res, next) => {
    const requestId = req.headers['x-request-id'] || null;

    const {
        entity_name,
        contact_name,
        designation,
        gst_number,
        cin_number,
        address1,
        address2,
        city,
        district,
        state,
        pincode,
        mobile_number,
        whatsapp_number,
        email_id,
        admin_mobile_number,
        admin_whatsapp_number,
        admin_email,
        password
    } = req.body;

    console.log('createClient request body:', req.body, 'by user:', req.user);

    // if (!entity_name || !gst_number || !cin_number) {
    //     return res.status(400).json({ message: "Required fields missing" });
    // }

    const MAX_RETRIES = parseInt(process.env.TRANSACTION_MAX_RETRIES || "3", 10);
    const BASE_DELAY_MS = parseInt(process.env.TRANSACTION_BACKOFF_MS || "100", 10);

    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        const session = await Client.startSession();
        let resultData;

        try {
            attempt++;

            await session.withTransaction(async () => {

                const duplicate = await Client.findOne({
                    gst_number: gst_number.toUpperCase().trim()
                }).session(session);

                if (duplicate) throw new Error("Duplicate Client: GST Number already exists!");

                const cp = await Client.create([{
                    tenant_id: req.user.tenant_id,
                    entity_name,
                    contact_name,
                    gst_number: gst_number.toUpperCase().trim(),
                    cin_number: cin_number.toUpperCase().trim(),
                    address1,
                    address2,
                    city,
                    district,
                    state,
                    pincode,
                    mobile_number,
                    whatsapp_number,
                    email_id,
                    auth_methods: ["local"],
                    status: "active"
                }], { session });

                const clientAdminRole = await Role.findOne({ name: "client_admin" }).session(session);
                if (!clientAdminRole) throw new Error("Client Admin role not found");

                const employee = await Employee.create([{
                    name: contact_name,
                    email: admin_email,
                    mobile_number: admin_mobile_number,
                    whatsapp_number: admin_whatsapp_number,
                    designation,
                    scope: "client",
                    tenant_id: req.user.tenant_id,
                    client_profile_id: cp[0]._id
                }], { session });

                const clientAdmin = await User.create([{
                    email: admin_email,
                    password,
                    role: clientAdminRole._id,
                    scope: "client",
                    tenant_id: req.user.tenant_id,
                    client_profile_id: cp[0]._id,
                    employee_id: employee[0]._id
                }], { session });

                resultData = {
                    client: cp[0],
                    clientAdmin: clientAdmin[0],
                    employee: employee[0]
                };
            });

            session.endSession();

            console.log("Transaction resultData:", resultData);

            if (resultData && resultData.client) {
                await logger.audit(
                    req.user?.employee_id || "SYSTEM",
                    req.user?.name || "SYSTEM",
                    req.user?.role || "unknown",
                    "create",
                    "client",
                    `Client ${resultData.client.entity_name} created`,
                    "success",
                    req.user?.tenant_id || null,
                    requestId
                );

                return res.status(201).json({
                    client: resultData.client,
                    admin: {
                        email: resultData.clientAdmin.email,
                        mobile_number: resultData.employee.mobile_number,
                        whatsapp_number: resultData.employee.whatsapp_number,
                        name: resultData.employee.name
                    },
                    employee: resultData.employee
                });
            }

        } catch (err) {
            console.error(`Client creation failed [Attempt ${attempt}]:`, err);
            session.endSession();

            if (err.message.includes("Duplicate Client")) {
                return res.status(409).json({ message: err.message });
            }

            if (err.errorLabels && (err.errorLabels.includes("TransientTransactionError") || err.errorLabels.includes("UnknownTransactionCommitResult"))) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }

            let status_code = err.code === 11000 ? 409 : 500;
            let message = err.code === 11000 ? "Duplicate client" : err.message;

            await logger.error(
                req.user?.employee_id || "SYSTEM",
                req.user?.name || "SYSTEM",
                req.user?.role || "unknown",
                err,
                "Client Provisioning",
                null,
                requestId,
                status_code
            );

            return res.status(status_code).json({ message });
        }
    }
};
/**
 * Get all clients for tenant
 */
exports.getClients = async (req, res, next) => {
    try {
        const clients = await Client.find({ tenant_id: req.user.tenant_id });

        const result = await Promise.all(
            clients.map(async (client) => {

                const employees = await Employee.find({
                    client_profile_id: client._id
                });

                const users = await User.find({
                    client_profile_id: client._id
                }).populate('role');

                return {
                    client,
                    employees,
                    users
                };
            })
        );

        await logger.audit(
            req.user.employee_id,
            req.user.employee_id?.name || "SYSTEM",
            req.user.role,
            "read",
            "client",
            "Fetched client list with full data",
            "success",
            req.user.tenant_id,
            req.trace_id
        );

        res.json(result);

    } catch (err) {
        await logger.error(
            req.user?.employee_id || "SYSTEM",
            req.user?.employee_id?.name || "SYSTEM",
            req.user?.role || "unknown",
            err,
            "clientRead",
            req.user?.tenant_id || null,
            req.trace_id,
            500
        );
        next(err);
    }
};

/**
 * Get client by ID
 */
exports.getClientById = async (req, res, next) => {
    try {
        const client = await Client.findOne({
            _id: req.params.id,
            tenant_id: req.user.tenant_id
        });

        if (!client) {
            return res.status(404).json({ message: "Client not found" });
        }

        const employees = await Employee.find({
            client_profile_id: client._id
        });

        const users = await User.find({
            client_profile_id: client._id
        }).populate('role');

        await logger.audit(
            req.user.employee_id,
            req.user.employee_id?.name || "SYSTEM",
            req.user.role,
            "read",
            "client",
            `Fetched client ${client.entity_name}`,
            "success",
            req.user.tenant_id,
            req.trace_id
        );

        res.json({
            client,
            employees,
            users
        });

    } catch (err) {
        await logger.error(
            req.user?.employee_id || "SYSTEM",
            req.user?.employee_id?.name || "SYSTEM",
            req.user?.role || "unknown",
            err,
            "clientRead",
            req.user?.tenant_id || null,
            req.trace_id,
            500
        );
        next(err);
    }
};

/**
 * Update client profile
 */
exports.updateClient = async (req, res, next) => {
    const requestId = req.headers['x-request-id'] || null;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const clientId = req.params.id;

        if (req.body.entity_name) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "entity_name cannot be updated" });
        }

        const allowedFields = [
            "contact_name",
            "designation",
            "gst_number",
            "cin_number",
            "address1",
            "address2",
            "city",
            "district",
            "state",
            "pincode",
            "mobile_number",
            "whatsapp_number",
            "email_id",
            "status"
        ];

        const updateFields = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateFields[field] = req.body[field];
            }
        });

        const client = await Client.findOneAndUpdate(
            { _id: clientId, tenant_id: req.user.tenant_id },
            { $set: updateFields },
            { new: true, runValidators: true, session }
        );

        if (!client) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Client not found" });
        }

        const empUpdate = {};
        const userUpdate = {};

        if (req.body.admin_email) {
            empUpdate.email = req.body.admin_email;
            userUpdate.email = req.body.admin_email;
        }

        if (req.body.admin_mobile_number) {
            empUpdate.mobile_number = req.body.admin_mobile_number;
        }

        if (req.body.admin_whatsapp_number) {
            empUpdate.whatsapp_number = req.body.admin_whatsapp_number;
        }

        if (Object.keys(empUpdate).length > 0) {
            await Employee.updateMany(
                { client_profile_id: clientId },
                { $set: empUpdate },
                { session }
            );
        }

        if (Object.keys(userUpdate).length > 0) {
            await User.updateMany(
                { client_profile_id: clientId },
                { $set: userUpdate },
                { session }
            );
        }

        await session.commitTransaction();
        session.endSession();

        // 🔥 FETCH FULL DATA AFTER UPDATE
        const employees = await Employee.find({ client_profile_id: clientId });
        const users = await User.find({ client_profile_id: clientId }).populate('role');

        await logger.audit(
            req.user.employee_id,
            req.user.name,
            req.user.role,
            "update",
            "client",
            `Client ${client.entity_name} updated`,
            "success",
            req.user.tenant_id,
            requestId
        );

        return res.status(200).json({
            message: "Client updated successfully",
            client,
            employees,
            users
        });

    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        await logger.error(
            req.user?.employee_id || "SYSTEM",
            req.user?.name || "SYSTEM",
            req.user?.role || "unknown",
            err,
            "clientUpdate",
            req.user?.tenant_id || null,
            requestId
        );

        return res.status(500).json({ message: err.message });
    }
};

/**
 * Delete client profile
 * Block deletion if client has users
 */
exports.deleteClient = async (req, res, next) => {
    try {
        const clientId = req.params.id;

        // Check if client has users
        const clientUsersCount = await User.countDocuments({ client_profile_id: clientId });
        if (clientUsersCount > 0) {
            return res.status(400).json({
                error: "Client has associated users. Please delete users first.",
                usersCount: clientUsersCount
            });
        }

        const client = await Client.findOneAndDelete({
            _id: clientId,
            tenant_id: req.user.tenant_id
        });

        if (!client) return res.status(404).json({ error: "Client not found" });

        await logger.audit(
            req.user.employee_id,
            req.user.employee_id.name,   // NEW: pass employee name
            req.user.role,
            "delete",
            "client",
            `Client ${client.entity_name} deleted`,
            "success",
            req.user.tenant_id,
            req.trace_id
        );

        res.json({ message: "Client deleted successfully" });
    } catch (err) {
        await logger.error(
            req.user?.employee_id || "SYSTEM",
            req.user?.employee_id?.name || "SYSTEM",
            req.user?.role || "unknown",
            err,
            "clientDelete",
            req.user?.tenant_id || null,
            req.trace_id,
            500
        );
        next(err);
    }
};












// const Client = require("../models/client.model");

// /**
//  * CREATE client
//  */
// exports.createClient = async (req, res) => {
//     try {
//         const client = await Client.create(req.body);
//         res.status(201).json({
//             success: true,
//             message: "Client created successfully",
//             data: client,
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

// /**
//  * GET all clients
//  */
// exports.getAllClients = async (req, res) => {
//     try {
//         const clients = await Client.find().sort({ createdAt: -1 });
//         res.status(200).json({
//             success: true,
//             data: clients,
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

// /**
//  * GET single client by ID
//  */
// exports.getClientById = async (req, res) => {
//     try {
//         const client = await Client.findById(req.params.id);

//         if (!client) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Client not found",
//             });
//         }

//         res.status(200).json({
//             success: true,
//             data: client,
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

// /**
//  * UPDATE client
//  */
// exports.updateClient = async (req, res) => {
//     try {
//         const client = await Client.findByIdAndUpdate(
//             req.params.id,
//             req.body,
//             { new: true, runValidators: true }
//         );

//         if (!client) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Client not found",
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: "Client updated successfully",
//             data: client,
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

// /**
//  * DELETE client
//  */
// exports.deleteClient = async (req, res) => {
//     try {
//         const client = await Client.findByIdAndDelete(req.params.id);

//         if (!client) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Client not found",
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: "Client deleted successfully",
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };
