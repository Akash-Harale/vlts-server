const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., 'vehicles', 'clients'
  description: String,
  actions: [{ type: String, default: ['create', 'read', 'update', 'delete'] }]
}, { collection: 'resources' });

module.exports = mongoose.model('Resource', resourceSchema);
