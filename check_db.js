const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (dnsErr) {
  console.warn('Warning: Failed to set custom DNS servers:', dnsErr.message);
}

const MONGO_URI = 'mongodb+srv://nutantek:123Delhi@cluster0.1bg9msl.mongodb.net/vlts_poc?appName=Cluster0';

async function check() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Collections in database:');
    collections.forEach(col => console.log(` - ${col.name}`));

    // Fetch existing roles
    try {
      const roles = await db.collection('roles').find().toArray();
      console.log('\nRoles:');
      roles.forEach(role => console.log(` - Name: ${role.name}, Scope: ${role.scope}, ID: ${role._id}`));
    } catch (e) {
      console.log('Error fetching roles:', e.message);
    }

    // Fetch some tenants
    try {
      const tenants = await db.collection('tenants').find().toArray();
      console.log('\nTenants (first 5):');
      tenants.slice(0, 5).forEach(t => console.log(` - ID: ${t.tenant_id}, Name: ${t.name}, DB ID: ${t._id}`));
    } catch (e) {
      console.log('Error fetching tenants:', e.message);
    }

    // Fetch superadmin user
    try {
      const users = await db.collection('users').find().toArray();
      console.log(`\nTotal Users: ${users.length}`);
      console.log('Matching superadmin:');
      const sa = users.filter(u => u.email === 'suresh.gupta@nutantek.com');
      sa.forEach(u => console.log(` - Email: ${u.email}, Role ID: ${u.role}, Scope: ${u.scope}`));
    } catch (e) {
      console.log('Error fetching users:', e.message);
    }

    await mongoose.disconnect();
    console.log('Disconnected!');
  } catch (err) {
    console.error('Error during check:', err);
  }
}

check();
