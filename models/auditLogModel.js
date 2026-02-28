// ./models/auditLogMode.js

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  trace_id: { type: String, required: true },
  request_id: String,
  emp_id: String,
  role: String,
  tenant_id: String,
  action: { type: String, required: true },
  resource: { type: String, required: true },
  reason: String,
  status: { type: String, enum: ["success", "failed"], required: true },
  timestamp: { type: Date, default: Date.now },
  log_date: { type: String, index: true } // YYYY-MM-DD for rotation
}, { collection: 'audit_logs' });

// Index for fast daily queries
auditLogSchema.index({ log_date: 1 });
auditLogSchema.index({ tenant_id: 1, log_date: 1 }); // optional compound index

module.exports = mongoose.model('AuditLog', auditLogSchema);

