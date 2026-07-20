const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (dnsErr) {
  console.warn('dns server setting failed', dnsErr);
}

const MONGO_URI = 'mongodb+srv://nutantek:123Delhi@cluster0.1bg9msl.mongodb.net/vlts_poc?appName=Cluster0';

async function check() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const indexes = await db.collection('tenants').indexes();
  console.log('Tenants indexes:', JSON.stringify(indexes, null, 2));
  await mongoose.disconnect();
}
check();
