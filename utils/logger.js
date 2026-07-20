// utils/logger.js

const { v4: uuidv4 } = require('uuid');
const AuditLog = require('../models/auditLogModel');
const ErrorLog = require('../models/errorLogModel');

/**
 * Centralized logger for audit and error logs.
 * Supports both old signature (8 arguments for audit, 7 for error) 
 * and new signature (9 arguments for audit, 8 for error).
 */
module.exports = {
  audit: async (...args) => {
    let empId, empName, role, action, resource, reason, status, tenantId, requestId;

    if (args.length <= 8) {
      // Old signature: empId, role, action, resource, reason, status, tenantId, requestId
      empId = args[0];
      role = args[1];
      action = args[2];
      resource = args[3];
      reason = args[4];
      status = args[5] || 'success';
      tenantId = args[6] || null;
      requestId = args[7] || null;
      empName = "N/A";
    } else {
      // New signature: empId, empName, role, action, resource, reason, status, tenantId, requestId
      empId = args[0];
      empName = args[1];
      role = args[2];
      action = args[3];
      resource = args[4];
      reason = args[5];
      status = args[6] || 'success';
      tenantId = args[7] || null;
      requestId = args[8] || null;
    }

    // Sanitize values to prevent mongoose validation failures
    if (status !== 'success' && status !== 'failed') {
      status = 'success';
    }

    const logEntry = new AuditLog({
      trace_id: uuidv4(),
      request_id: requestId,
      emp_id: empId ? empId.toString() : "SYSTEM",
      emp_name: empName ? empName.toString() : "N/A",
      role: role ? role.toString() : "SYSTEM",
      tenant_id: tenantId ? tenantId.toString() : null,
      action: action ? action.toString() : "unknown",
      resource: resource ? resource.toString() : "unknown",
      reason: reason ? reason.toString() : "",
      status: status,
      timestamp: new Date()
    });

    try {
      await logEntry.save();
    } catch (saveErr) {
      console.warn("Warning: Failed to save AuditLog:", saveErr.message);
    }
  },

  error: async (...args) => {
    let empId, empName, role, error, resource, tenantId, requestId, statusCode;

    if (args.length <= 7) {
      // Old signature: empId, role, error, resource, tenantId, requestId, statusCode
      empId = args[0];
      role = args[1];
      error = args[2];
      resource = args[3];
      tenantId = args[4] || null;
      requestId = args[5] || null;
      statusCode = args[6] || 500;
      empName = "SYSTEM";
    } else {
      // New signature: empId, empName, role, error, resource, tenantId, requestId, statusCode
      empId = args[0];
      empName = args[1];
      role = args[2];
      error = args[3];
      resource = args[4];
      tenantId = args[5] || null;
      requestId = args[6] || null;
      statusCode = args[7] || 500;
    }

    const logEntry = new ErrorLog({
      trace_id: uuidv4(),
      request_id: requestId,
      emp_id: empId ? empId.toString() : "SYSTEM",
      emp_name: empName ? empName.toString() : "SYSTEM",
      role: role ? role.toString() : "unknown",
      tenant_id: tenantId ? tenantId.toString() : null,
      resource: resource ? resource.toString() : "unknown",
      error_message: error ? (error.message || error.toString()) : "Unknown error",
      stack: error ? (error.stack || "") : "",
      status_code: typeof statusCode === 'number' ? statusCode : 500,
      timestamp: new Date()
    });

    try {
      await logEntry.save();
    } catch (saveErr) {
      console.warn("Warning: Failed to save ErrorLog:", saveErr.message);
    }
  }
};



