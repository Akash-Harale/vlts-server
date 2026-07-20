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
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const roles = await db.collection('roles').find().toArray();
    console.log(JSON.stringify(roles, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

check();
