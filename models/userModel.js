// models/userModel.js

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userModelSchema = new mongoose.Schema({
  user_id: { type: String, unique: true, sparse: true },
  emp_id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: false }
}, { collection: 'users' });

// Pre-save hook for password hashing
userModelSchema.pre('save', async function () {
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

module.exports = mongoose.model('UserModel', userModelSchema);