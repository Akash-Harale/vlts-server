// utils/logger.js

const { v4: uuidv4 } = require("uuid");
const AuditLog = require("../models/auditLogModel");
const ErrorLog = require("../models/errorLogModel");

/**
 * Centralized logger for audit and error logs.
 * Adds rotation strategy via log_date field.
 */
module.exports = {
  /**
   * Write an audit log entry
   */
  audit: async (
    empId,
    role,
    action,
    resource,
    reason,
    status = "success",
    tenantId = null,
    requestId = null
  ) => {
    const today = new Date();
    const logEntry = new AuditLog({
      trace_id: uuidv4(),
      request_id: requestId,
      emp_id: empId,
      role,
      tenant_id: tenantId,
      action,
      resource,
      reason,
      status,
      timestamp: today,
      log_date: today.toISOString().split("T")[0] // YYYY-MM-DD
    });
    await logEntry.save();
    console.log("AUDIT_LOG:", JSON.stringify(logEntry));
  },

  /**
   * Write an error log entry
   */
  error: async (
    empId,
    role,
    error,
    resource,
    tenantId = null,
    requestId = null,
    statusCode = 500
  ) => {
    const today = new Date();
    const logEntry = new ErrorLog({
      trace_id: uuidv4(),
      request_id: requestId,
      emp_id: empId,
      role,
      tenant_id: tenantId,
      resource,
      error_message: error.message,
      stack: error.stack,
      status_code: statusCode,
      timestamp: today,
      log_date: today.toISOString().split("T")[0] // YYYY-MM-DD
    });
    await logEntry.save();
    console.error("ERROR_LOG:", JSON.stringify(logEntry));
  }
};


