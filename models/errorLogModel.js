// ./models/errorLogModel.js
const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  trace_id: { type: String, required: true },
  request_id: String,
  emp_id: String,
  role: String,
  tenant_id: String,
  resource: { type: String, required: true },
  error_message: { type: String, required: true },
  stack: String,
  status_code: { type: Number, default: 500 },
  timestamp: { type: Date, default: Date.now },
  log_date: { type: String, index: true } // YYYY-MM-DD for rotation
}, { collection: 'error_logs' });

// Index for fast daily queries
errorLogSchema.index({ log_date: 1 });
errorLogSchema.index({ tenant_id: 1, log_date: 1 }); // optional compound index

module.exports = mongoose.model('ErrorLog', errorLogSchema);

