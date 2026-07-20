
// models/userModel.js
// Updated schema on 6 April with filed: scope added

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  scope: { type: String, enum: ["system", "tenant", "client"], required: true }, // denormalized for faster reporting
  tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  client_profile_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' }
}, { collection: 'users' });

userSchema.pre('save', async function () {
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

userSchema.index({ role: 1, scope: 1 }); // optimize role/scope queries

module.exports = mongoose.model('User', userSchema);








// // models/userModel.js

// const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');

// const userModelSchema = new mongoose.Schema({
//   user_id: { type: String, unique: true, sparse: true },
//   employee_id: { type: String, required: true, unique: true },
//   email: { type: String, required: true, unique: true },
//   password: { type: String },
//   role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
//   tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: false }
// }, { collection: 'users' });

// // Pre-save hook for password hashing
// userModelSchema.pre('save', async function () {
//   if (this.password && this.isModified('password')) {
//     this.password = await bcrypt.hash(this.password, 10);
//   }
// });

// module.exports = mongoose.model('UserModel', userModelSchema);