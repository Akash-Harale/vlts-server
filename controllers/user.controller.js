// Tenant User Controller   --- Tenant Admin Only
// 23/03/2026
// Purpose: Manage tenant users (CRUD) — Tenant Admin only.
// Uses Employee module with composite emp_id generation.
// Includes audit logging and structured error handling.
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Employee = require('../models/employeeModel');
const ClientProfile = require('../models/client.model');
const Role = require('../models/roleModel');
const logger = require('../utils/logger');


exports.getRoles = async (req, res, next) => {
  try {
    const isClientRole = req.user?.role?.startsWith("client_");
    let query = {};
    if (isClientRole) {
      query = { name: { $regex: "^client_", $ne: "client_admin" } };
    } else {
      query = { scope: "tenant" };
    }
    const roles = await Role.find(query);
    res.json(roles);
  } catch (err) {
    next(err);
  }
};

exports.createUser = async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || null;

  const MAX_RETRIES = parseInt(process.env.TRANSACTION_MAX_RETRIES || "3", 10);
  const BASE_DELAY_MS = parseInt(process.env.TRANSACTION_BACKOFF_MS || "100", 10);

  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    const session = await mongoose.startSession();

    try {
      attempt++;

      const result = await session.withTransaction(async () => {
        const { name, email, mobile_number, designation, password, roleName } = req.body;

        if (req.user?.role?.startsWith("client_") && roleName === 'client_admin') {
          throw new Error("Cannot assign client_admin role");
        }

        const role = await Role.findOne({ name: roleName }).session(session);
        if (!role) {
          throw new Error(`Role ${roleName} not found`);
        }
        console.log("body: ", req.body);
        const employee = await Employee.create([{
          name,
          email,
          mobile_number,
          designation,
          scope: req.user?.role?.startsWith("client_") ? "client" : "tenant",
          tenant_id: req.user.tenant_id,
          client_profile_id: req.user?.client_profile_id || null
        }], { session });
        console.log("employee created: ", employee);
        const user = await User.create([{
          employee_id: employee[0]._id,
          email,
          password,
          role: role._id,
          scope: req.user?.role?.startsWith("client_") ? "client" : "system",
          tenant_id: req.user.tenant_id,
          client_profile_id: req.user?.client_profile_id || null
        }], { session });
        console.log("user created: ", user);
        return { employee: employee[0], user: user[0] };
      });

      session.endSession();

      if (result) {
        await logger.audit(
          req.user.employee_id,
          req.user.name,
          req.user.role,
          "create",
          "user",
          `Tenant user created`,
          "success",
          req.user.tenant_id,
          requestId
        );

        return res.status(201).json({ message: "Tenant user created successfully" });
      }

    } catch (err) {
      session.endSession();

      if (err.errorLabels && (err.errorLabels.includes("TransientTransactionError") || err.errorLabels.includes("UnknownTransactionCommitResult"))) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      let status_code = 500;
      let message = err.message;

      await logger.error(
        req.user?.employee_id || "SYSTEM",
        req.user?.name || "SYSTEM",
        req.user?.role || "unknown",
        err,
        "tenantUserCreate",
        req.user?.tenant_id || null,
        requestId,
        status_code
      );

      return res.status(status_code).json({ message });
    }
  }
};


/**
 * Get all users in tenant
 */
exports.getUsers = async (req, res, next) => {
  try {
    const query = { tenant_id: req.user.tenant_id };
    if (req.user.client_profile_id) {
      query.client_profile_id = req.user.client_profile_id;
    }
    const users = await User.find(query)
      .populate('role')
      .populate('employee_id');
    res.json(users);
  } catch (err) {
    await logger.error(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      err,
      "tenantUserRead",
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );
    next(err);
  }
};

/**
 * Get tenant user by ID
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      tenant_id: req.user.tenant_id,
      client_profile_id: req.user?.client_profile_id || { $exists: true }
    }).populate('role').populate('employee_id');

    if (!user) {
      return res.status(404).json({ message: "Tenant user not found" });
    }

    res.json(user);
  } catch (err) {
    await logger.error(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      err,
      "tenantUserRead",
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );
    next(err);
  }
};


/**
 * Update tenant user
 * PUT /api/auth/tenantadmin/users/:id
 */
exports.updateUser = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { roleName, designation, mobile_number, name } = req.body;
    const userId = req.params.id;

    if (!roleName && !designation && !mobile_number && !name) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "At least one field (roleName, designation, mobile_number, name) is required"
      });
    }

    const user = await User.findOne({
      _id: userId,
      tenant_id: req.user.tenant_id,
      client_profile_id: req.user?.client_profile_id || { $exists: true }
    }).populate('role').session(session);

    // if user is admin then can't be edited, client admin has to contact with tenant admin to edit
    if (user.role.name === 'client_admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: `Cannot edit client_admin role` });
    }

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Tenant user not found" });
    }

    // ROLE UPDATE — lookup by name
    if (roleName) {
      const isClientRole = req.user?.role?.startsWith("client_");
      const roleQuery = { name: roleName };
      if (isClientRole) {
        if (roleName === 'client_admin') {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: `Cannot assign client_admin role` });
        }
      }

      const newRole = await Role.findOne(roleQuery).session(session);

      if (!newRole) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `Invalid role: ${roleName}` });
      }

      if (user.role._id.toString() !== newRole._id.toString()) {
        user.role = newRole._id;
        await user.save({ session });
      }
    }

    // EMPLOYEE UPDATE
    const empUpdate = {};
    if (designation) empUpdate.designation = designation;
    if (mobile_number) empUpdate.mobile_number = mobile_number;
    if (name) empUpdate.name = name;

    if (Object.keys(empUpdate).length > 0) {
      await Employee.findByIdAndUpdate(
        user.employee_id,
        { $set: empUpdate },
        { new: true, runValidators: true, session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    await logger.audit(
      req.user.employee_id,
      req.user.name,
      req.user.role,
      "update",
      "user",
      `Tenant user updated (${userId})`,
      "success",
      req.user.tenant_id,
      req.trace_id
    );

    return res.status(200).json({ message: "Tenant user updated successfully" });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    await logger.error(
      req.user?.employee_id || "SYSTEM",
      req.user?.name || "SYSTEM",
      req.user?.role || "unknown",
      err, "tenantUserUpdate", req.user?.tenant_id || null, req.trace_id
    );

    return res.status(500).json({ message: err.message });
  }
};

/**
 * Delete tenant user
 * DELETE /api/auth/tenantadmin/users/:id
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      tenant_id: req.user.tenant_id,
      client_profile_id: req.user?.client_profile_id || { $exists: true }
    }).populate('role').populate('employee_id');

    if (!user) return res.status(404).json({ error: "User not found" });

    // Step 1: If user is tenant_admin, check dependencies
    if (user.role.name === "client_admin") {
      return res.status(400).json({ error: "Cannot delete client_admin user" });
    }

    // Step 2: Safe to delete User and Employee
    console.log("User to be deleted" + "======================================================>" + user)
    await User.deleteOne({ _id: user._id });
    console.log("User deleted successfully")
    await Employee.findByIdAndDelete(user.employee_id._id);
    console.log("Employee deleted successfully")

    await logger.audit(
      req.user.employee_id,
      req.user.employee_id.name,
      req.user.role,
      "delete",
      "user",
      `Tenant user ${user.employee_id.name} (${user.employee_id}) deleted`,
      "success",
      req.user.tenant_id,
      req.trace_id
    );

    res.status(201).json({
      message: "Tenant user deleted successfully"
    });
  } catch (err) {
    await logger.error(
      req.user?.employee_id || "SYSTEM",
      req.user?.employee_id?.name || "SYSTEM",
      req.user?.role || "unknown",
      err,
      "tenantUserDelete",
      req.user?.tenant_id || null,
      req.trace_id,
      500
    );
    next(err);
  }
};














// // controllers/tenantUserController.js
// // Purpose: Manage tenant users (CRUD) — Tenant Admin only

// const User = require('../models/userModel');
// const Role = require('../models/roleModel');
// const logger = require('../utils/logger');

// /**
//  * Create a new tenant user
//  * Body: { emp_id, email, password, roleName }
//  */
// exports.createTenantUser = async (req, res, next) => {
//   const requestId = req.headers['x-request-id'] || null;
//   try {
//     const { emp_id, email, password, roleName } = req.body;

//     // Ensure role exists
//     const role = await Role.findOne({ name: roleName });
//     if (!role) {
//       throw new Error(`Role ${roleName} not found`);
//     }

//     // Create user scoped to tenant
//     const user = await User.create({
//       emp_id,
//       email,
//       password, // pre-save hook will hash
//       role: role._id,
//       tenant_id: req.user.tenant_id
//     });

//     await logger.audit(
//       req.user.emp_id,
//       req.user.role,
//       "create",
//       "user",
//       `Tenant user ${email} created with role ${roleName}`,
//       "success",
//       req.user.tenant_id,
//       requestId
//     );

//     res.status(201).json(user);
//   } catch (err) {
//     await logger.error(
//       req.user.emp_id,
//       req.user.role,
//       err,
//       "tenantUserCreate",
//       req.user.tenant_id,
//       requestId,
//       500
//     );
//     next(err);
//   }
// };

// /**
//  * Get all users in tenant
//  */
// exports.getTenantUsers = async (req, res, next) => {
//   try {
//     const users = await User.find({ tenant_id: req.user.tenant_id }).populate('role');
//     res.json(users);
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * Update tenant user
//  * PUT /api/auth/tenantadmin/users/:id
//  */
// exports.updateTenantUser = async (req, res, next) => {
//   try {
//     const user = await User.findOneAndUpdate(
//       { _id: req.params.id, tenant_id: req.user.tenant_id },
//       req.body,
//       { new: true }
//     ).populate('role');

//     if (!user) return res.status(404).json({ error: "User not found" });
//     res.json(user);
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * Delete tenant user
//  * DELETE /api/auth/tenantadmin/users/:id
//  */
// exports.deleteTenantUser = async (req, res, next) => {
//   try {
//     const user = await User.findOneAndDelete({
//       _id: req.params.id,
//       tenant_id: req.user.tenant_id
//     });

//     if (!user) return res.status(404).json({ error: "User not found" });
//     res.json({ message: "Tenant user deleted successfully" });
//   } catch (err) {
//     next(err);
//   }
// };
