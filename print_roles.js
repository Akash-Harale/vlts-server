const mongoose = require('mongoose');
const dns = require('dns');
const fs = require('fs');

try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (dnsErr) {
  console.warn('dns server setting failed', dnsErr);
}

const MONGO_URI = 'mongodb+srv://nutantek:123Delhi@cluster0.1bg9msl.mongodb.net/vlts_poc?appName=Cluster0';

async function run() {
  await mongoose.connect(MONGO_URI);
  const roles = await mongoose.connection.db.collection('roles').find().toArray();
  let output = '';
  for (let r of roles) {
    output += `ID: ${r._id.toString()} | Name: "${r.name}" | Scope: "${r.scope}" | Privileges: ${JSON.stringify(r.privileges)}\n`;
  }
  fs.writeFileSync('roles_dump.txt', output);
  console.log('Done!');
  await mongoose.disconnect();
}
run();
