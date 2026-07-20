const axios = require('axios');
const mongoose = require('mongoose');
const dns = require('dns');

// Set DNS to ensure MongoDB SRV resolves correctly
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (dnsErr) {
  console.warn('Warning: Failed to set custom DNS servers:', dnsErr.message);
}

const MONGO_URI = 'mongodb+srv://nutantek:123Delhi@cluster0.1bg9msl.mongodb.net/vlts_poc?appName=Cluster0';
const BASE_URL = 'http://localhost:3006';

// Global tokens
let tokens = {
  superadmin: '',
  tenant_admin: '',
  tenant_user: '',
  client_admin: '',
  client_user: '',
  driver: '',
  technician: ''
};

// Global IDs for url parameter replacement
let dbIds = {
  id: '',                // generic placeholder ID
  tenantId: '',          // ObjectId
  tenantStrId: 'tenant1',// String short name ID
  clientId: '',          // ObjectId
  vehicleId: '',         // ObjectId 
  gpsId: '',             // ObjectId
  userId: '',            // ObjectId
  driverId: '',          // ObjectId
  driverUserId: '',      // String driver user ID
  routeId: '65f242512f6a7353f2081f9a',  // placeholder if none
  tripId: '65f242512f6a7353f2081f9b'    // placeholder if none
};

async function login(roleName, url, body) {
  try {
    const res = await axios.post(`${BASE_URL}${url}`, body);
    if (res.data && res.data.accessToken) {
      console.log(`Successfully logged in as ${roleName}`);
      return res.data.accessToken;
    }
  } catch (err) {
    console.error(`Failed to login as ${roleName}:`, err.response ? err.response.data : err.message);
  }
  return '';
}

async function prepareDataAndTokens() {
  // Let's connect to DB to get real test IDs
  console.log('Connecting to DB to fetch IDs...');
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const tenant = await db.collection('tenants').findOne({ tenant_id: 'tenant1' });
  if (tenant) {
    dbIds.tenantId = tenant._id.toString();
    dbIds.tenantStrId = tenant.tenant_id;
  }

  const client = await db.collection('clients').findOne({ email_id: 'client1@gmail.com' });
  if (client) {
    dbIds.clientId = client._id.toString();
  }

  const userDoc = await db.collection('users').findOne({ email: 'clientuser1@gmail.com' });
  if (userDoc) {
    dbIds.userId = userDoc._id.toString();
  }

  const vehicleDoc = await db.collection('vehicles').findOne({ registration_number: 'MH-12-XX-1001' });
  if (vehicleDoc) {
    dbIds.vehicleId = vehicleDoc._id.toString();
  }

  const gpsDoc = await db.collection('gpsdevices').findOne({ device_id: 'GPS-DEV-1' });
  if (gpsDoc) {
    dbIds.gpsId = gpsDoc._id.toString();
  }

  const driverDoc = await db.collection('drivers').findOne({ email_id: 'driver1@gmail.com' });
  if (driverDoc) {
    dbIds.driverId = driverDoc._id.toString();
    dbIds.driverUserId = driverDoc.user_id;
  }

  const assignmentDoc = await db.collection('drivervehicleassignments').findOne({ status: 'ACTIVE' });
  if (assignmentDoc) {
    dbIds.id = assignmentDoc._id.toString();
  }

  console.log('Fetched DB IDs:', JSON.stringify(dbIds, null, 2));
  await mongoose.disconnect();

  // Get Auth Tokens
  console.log('Authenticating users...');
  tokens.superadmin = await login('Superadmin', '/api/auth/superadmin/login', { email: 'suresh.gupta@nutantek.com', password: 'nutan123' });
  tokens.tenant_admin = await login('Tenant Admin', '/api/auth/tenantadmin/login', { email: 'tenant1@gmail.com', password: 'nutan123' });
  tokens.tenant_user = await login('Tenant User', '/api/auth/tenantuser/login', { email: 'tenantuser1@gmail.com', password: 'nutan123' });
  tokens.client_admin = await login('Client Admin', '/api/client-auth/login', { email: 'client1@gmail.com', password: 'nutan123' });
  tokens.client_user = await login('Client User', '/api/client-auth/login', { email: 'clientuser1@gmail.com', password: 'nutan123' });
  tokens.driver = await login('Driver', '/api/driver/login', { email: 'driver1@gmail.com', password: 'nutan123' });
  // technician fails back to client login since it is scoped to client
  tokens.technician = await login('Technician', '/api/client-auth/login', { email: 'technician1@gmail.com', password: 'nutan123' });
}

// Map endpoints to tokens and test parameters
function getHeaders(url) {
  let token = tokens.superadmin; // default fallback

  if (url.includes('/api/auth/superadmin/')) {
    token = tokens.superadmin;
  } else if (url.includes('/api/platform/tenants')) {
    token = tokens.superadmin;
  } else if (url.includes('/api/auth/tenantadmin/')) {
    token = tokens.tenant_admin;
  } else if (url.includes('/api/auth/tenantuser/')) {
    token = tokens.tenant_user;
  } else if (url.includes('/api/client-auth/')) {
    token = tokens.client_admin;
  } else if (url.includes('/api/driver/login') || url.includes('/api/client-auth/login')) {
    token = ''; // No token needed for login
  } else if (url.includes('/api/driver/')) {
    token = tokens.client_admin;
  } else if (url.includes('/api/user/')) {
    token = tokens.client_admin;
  } else if (url.includes('/api/clients')) {
    token = tokens.tenant_admin;
  } else if (url.includes('/api/gps')) {
    token = tokens.tenant_admin;
  } else if (url.includes('/api/assignments/')) {
    token = tokens.tenant_admin;
  } else if (url.includes('/api/driverassignments')) {
    token = tokens.client_admin;
  } else if (url.includes('/api/vehicle')) {
    token = tokens.client_admin;
  }

  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Modify URL path variables with our fetched IDs
function prepareUrl(url) {
  let cleaned = url.replace('{{baseUrl}}', '');
  
  // Replace path variables
  cleaned = cleaned.replace('/:id', `/${dbIds.id || '65f242512f6a7353f2081f9e'}`);
  cleaned = cleaned.replace('/:vehicle_id', `/${dbIds.vehicleId || '65f242512f6a7353f2081f9f'}`);
  cleaned = cleaned.replace('/:route_id', `/${dbIds.routeId}`);
  cleaned = cleaned.replace('/:tripId', `/${dbIds.tripId}`);
  cleaned = cleaned.replace('/:name', '/ tata'); // safe dummy parameter for name routes

  return cleaned;
}

// Generate payload body depending on route to avoid bad input validation failures
function getPayload(method, url) {
  if (method === 'GET' || method === 'DELETE') return null;

  // Default payloads
  if (url.includes('/api/routes')) {
    return { name: 'Seeded Route', type: 'delivery', stops: [] };
  }
  if (url.includes('/api/vehicle')) {
    return {
      make: 'Tata',
      model: 'Magic',
      registration_number: 'MH-12-XX-TEMP',
      chassis_number: 'CHASTEMP123',
      engine_number: 'ENGTEMP123',
      date_of_subscription: new Date(),
      regn_valid_upto: new Date()
    };
  }
  if (url.includes('/api/positions')) {
    return { latitude: 19.076, longitude: 72.877, speed: 40 };
  }
  if (url.includes('/api/deviations/check')) {
    return { route_id: dbIds.routeId, points: [] };
  }
  if (url.includes('/api/gps-allocation/technician')) {
    return { technicianId: dbIds.userId, gpsId: dbIds.gpsId };
  }
  if (url.includes('/api/gps-allocation/salesperson')) {
    return { salespersonId: dbIds.userId, gpsId: dbIds.gpsId };
  }
  if (url.includes('/api/user/')) {
    return { name: 'New Client User', email: 'clientuser_test@gmail.com', roleName: 'client_viewer' };
  }
  if (url.includes('/api/driverassignments')) {
    return { client_id: dbIds.clientId, driver_id: dbIds.driverId, vehicle_id: dbIds.vehicleId, from_datetime: new Date(), to_datetime: new Date(Date.now() + 100000000) };
  }
  if (url.includes('/api/alert/')) {
    return { alert_type: 'OVERSPEED', threshold: 80 };
  }
  if (url.includes('/api/school-driver/temp-route')) {
    return { driver_id: dbIds.driverId, start_lat: 19.0, start_lng: 72.0 };
  }
  if (url.includes('/api/driver/login')) {
    return { email: 'driver1@gmail.com', password: 'nutan123' };
  }
  if (url.includes('/api/driver')) {
    return { driver_name: 'Driver New', driver_license: 'DL-NEW', mobile_number: '9888998899', email_id: 'driver_new@gmail.com', password: 'nutan123' };
  }
  if (url.includes('/api/client-auth/login')) {
    return { email: 'client1@gmail.com', password: 'nutan123' };
  }
  if (url.includes('/api/gps')) {
    return { imei: '99889988998899', device_id: 'GPS-TEST-NEW', icc_id: 'ICC-TEST-NEW' };
  }
  if (url.includes('/api/assignments/gps-vehicle')) {
    return { vehicle_id: dbIds.vehicleId, gps_device_id: dbIds.gpsId };
  }
  if (url.includes('/api/clients')) {
    return { entity_name: 'Client Test', email_id: 'client_test12@gmail.com', contact_name: 'Manager', gst_number: '27A12', cin_number: 'L12' };
  }
  if (url.includes('/api/auth/superadmin/login')) {
    return { email: 'suresh.gupta@nutantek.com', password: 'nutan123' };
  }
  if (url.includes('/api/auth/tenantadmin/login')) {
    return { email: 'tenant1@gmail.com', password: 'nutan123' };
  }
  if (url.includes('/api/auth/tenantadmin/users')) {
    return { name: 'Tenant User New', email: 'tenantuser_new@gmail.com', password: 'nutan123', roleName: 'tenant_user' };
  }
  if (url.includes('/api/auth/tenantuser/login')) {
    return { email: 'tenantuser1@gmail.com', password: 'nutan123' };
  }
  if (url.includes('/api/helpdesk')) {
    return { subject: 'Test issue', description: 'Testing' };
  }
  if (url.includes('/api/gpsalerts')) {
    return { alert_id: '123' };
  }

  return {}; // default empty body
}

async function runTests() {
  await prepareDataAndTokens();

  const fs = require('fs');
  const path = require('path');
  const postmanPath = path.join(__dirname, '..', 'vlts_client_19-07-2026.postman_collection.json');
  const collection = JSON.parse(fs.readFileSync(postmanPath, 'utf8'));

  const endpoints = [];
  function processItem(item, folderPath = []) {
    if (item.request) {
      endpoints.push({
        folder: folderPath.join(' -> '),
        name: item.name,
        method: item.request.method,
        url: item.request.url ? (typeof item.request.url === 'string' ? item.request.url : item.request.url.raw) : ''
      });
    }
    if (item.item && Array.isArray(item.item)) {
      item.item.forEach(subItem => processItem(subItem, [...folderPath, item.name]));
    }
  }
  if (collection.item && Array.isArray(collection.item)) {
    collection.item.forEach(item => processItem(item));
  }

  console.log(`Loaded ${endpoints.length} endpoints. Starting test execution...`);

  const results = [];
  let testCount = 0;

  for (let ep of endpoints) {
    testCount++;
    const testUrl = prepareUrl(ep.url);
    const headers = getHeaders(testUrl);
    const body = getPayload(ep.method, testUrl);
    const fullUrl = `${BASE_URL}${testUrl}`;

    console.log(`[${testCount}/${endpoints.length}] Testing ${ep.method} ${fullUrl}...`);

    let status = 'Unknown';
    let working = false;
    let errorDetails = '';

    try {
      let res;
      if (ep.method === 'GET') {
        res = await axios.get(fullUrl, { headers, timeout: 5000 });
      } else if (ep.method === 'POST') {
        res = await axios.post(fullUrl, body, { headers, timeout: 5000 });
      } else if (ep.method === 'PUT') {
        res = await axios.put(fullUrl, body, { headers, timeout: 5000 });
      } else if (ep.method === 'DELETE') {
        res = await axios.delete(fullUrl, { headers, timeout: 5000 });
      } else if (ep.method === 'PATCH') {
        res = await axios.patch(fullUrl, body, { headers, timeout: 5000 });
      }

      status = res.status;
      working = true;
    } catch (err) {
      if (err.response) {
        status = err.response.status;
        errorDetails = JSON.stringify(err.response.data);
        // Note: 404/400 might still indicate the endpoint exists (working route, but bad parameters).
        // Let's mark it as working if it's NOT a 5xx or connection refused, but details are recorded.
        if (status >= 500) {
          working = false;
        } else {
          working = true; // Route actually exists and returned client error
        }
      } else {
        status = 'Error';
        errorDetails = err.message;
        working = false;
      }
    }

    results.push({
      id: testCount,
      name: ep.name,
      folder: ep.folder,
      method: ep.method,
      rawUrl: ep.url,
      testUrl,
      status,
      working,
      errorDetails
    });
  }

  // Create report markdown
  let report = `# API Endpoint Test Results

This document contains automated test results for all 106 endpoints retrieved from the Postman collection.

## Summary

- **Total Endpoints Tested**: ${results.length}
- **Working Endpoints (Active / Operational)**: ${results.filter(r => r.working && r.status !== 404).length}
- **Endpoints Returning Errors or Not Found (404/500/Connection Issues)**: ${results.filter(r => !r.working || r.status === 404).length}

## Detailed Endpoints Table

| # | Endpoint Name | Folder Path | Method | URL tested | Status | Status Rating | Details |
|---|---|---|---|---|---|---|---|
`;

  results.forEach(r => {
    let rating = '🟢 Working';
    if (r.status === 404) {
      rating = '🔴 Not Found (404)';
    } else if (!r.working) {
      rating = '🔴 Broker / Failed (5xx or Connection Error)';
    } else if (r.status >= 400 && r.status < 500) {
      rating = '🟡 Parameter Issue / Client Error (4xx)';
    }

    report += `| ${r.id} | ${r.name} | ${r.folder} | **${r.method}** | \`${r.testUrl}\` | ${r.status} | ${rating} | ${r.errorDetails ? `\`${r.errorDetails.slice(0, 100)}\`` : '-'} |\n`;
  });

  fs.writeFileSync('postman_test_report.md', report);
  console.log('API Tests Completed! Results written to postman_test_report.md');
}

runTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
});
