const mongoose = require('mongoose');
const dns = require('dns');
const bcrypt = require('bcrypt');

// Set DNS to ensure MongoDB SRV resolves correctly on this machine
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (dnsErr) {
  console.warn('Warning: Failed to set custom DNS servers:', dnsErr.message);
}

const MONGO_URI = 'mongodb+srv://nutantek:123Delhi@cluster0.1bg9msl.mongodb.net/vlts_poc?appName=Cluster0';

async function seed() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected successfully!');

    const db = mongoose.connection.db;

    // Helper to generate salt and hash
    const hashedPassword = await bcrypt.hash('nutan123', 10);
    console.log('Generated hashed password for all users.');

    // 1. Roles Lookup or Verification
    console.log('Resolving roles...');
    const rolesColl = db.collection('roles');
    
    // Check if we need to insert roles (based on names)
    const requiredRoles = [
      { _id: new mongoose.Types.ObjectId('6a58d7af32a2f7e59ff980a7'), name: 'super_admin', scope: 'system', privileges: ['create', 'read', 'update', 'delete', 'provision_tenant', 'manage_billing', 'audit_logs', 'manage_configs', 'create_roles', 'read_roles', 'update_roles', 'delete_roles'] },
      { _id: new mongoose.Types.ObjectId('6a58d7b032a2f7e59ff980b1'), name: 'tenant_admin', scope: 'tenant', privileges: ['create_user', 'read_user', 'update_user', 'delete_user', 'manage_clients', 'audit_logs', 'create_gps', 'update_gps', 'read_gps', 'delete_gps', 'read_gps_allocation', 'allocate_gps', 'unallocate_gps_allocation', 'delete_gps_allocation', 'create_heartbeat', 'map_device_to_vehicle', 'read_mapped_device_to_vehicle', 'update_mapped_device_to_vehicle', 'delete_mapped_device_to_vehicle', 'read_roles', 'create_vehicle', 'read_vehicle', 'update_vehicle', 'delete_vehicle'] },
      { _id: new mongoose.Types.ObjectId('6a58d7b132a2f7e59ff980b9'), name: 'tenant_user', scope: 'tenant', privileges: ['read', 'update_limited'] },
      { _id: new mongoose.Types.ObjectId('6a58d7b132a2f7e59ff980bd'), name: 'client_admin', scope: 'client', privileges: ['create_user', 'read_user', 'update_user', 'delete_user', 'manage_resources', 'approve_trips', 'create_trips', 'read_trips', 'update_trips', 'delete_trips', 'create_driver', 'read_driver', 'update_driver', 'delete_driver', 'create_driver_assignment', 'read_driver_assignment', 'update_driver_assignment', 'delete_driver_assignment', 'read_vehicle', 'check_availability', 'read_alert', 'create_alert', 'update_alert', 'delete_alert'] },
      { _id: new mongoose.Types.ObjectId('6a58d7b132a2f7e59ff980bf'), name: 'client_manager', scope: 'client', privileges: ['create_resources', 'read_resources', 'update_resources'] },
      { _id: new mongoose.Types.ObjectId('6a59dda465a62309cb0b5357'), name: 'technician', scope: 'client', privileges: ['create_user', 'read_user', 'update_user', 'delete_user', 'manage_resources', 'approve_trips', 'create_trips', 'read_trips', 'update_trips', 'delete_trips', 'create_driver', 'read_driver', 'update_driver', 'delete_driver', 'create_driver_assignment', 'read_driver_assignment', 'update_driver_assignment', 'delete_driver_assignment', 'read_vehicle', 'check_availability'] },
      { _id: new mongoose.Types.ObjectId('6a59e525dc3e9a058df4abc2'), name: 'salesperson', scope: 'tenant', privileges: ['read_clients'] },
      { _id: new mongoose.Types.ObjectId('69f88fe73e138c94685cd2e5'), name: 'driver', scope: 'client', privileges: [] }
    ];

    for (let r of requiredRoles) {
      const existing = await rolesColl.findOne({ name: r.name });
      if (!existing) {
        await rolesColl.insertOne(r);
        console.log(` - Created role: ${r.name}`);
      } else {
        r._id = existing._id; // Use existing ID if already there
      }
    }

    const superAdminRole = requiredRoles.find(r => r.name === 'super_admin');
    const tenantAdminRole = requiredRoles.find(r => r.name === 'tenant_admin');
    const tenantUserRole = requiredRoles.find(r => r.name === 'tenant_user');
    const clientAdminRole = requiredRoles.find(r => r.name === 'client_admin');
    const clientManagerRole = requiredRoles.find(r => r.name === 'client_manager');
    const technicianRole = requiredRoles.find(r => r.name === 'technician');
    const salespersonRole = requiredRoles.find(r => r.name === 'salesperson');
    const driverRole = requiredRoles.find(r => r.name === 'driver');

    // 2. Clean up previous test seed data
    console.log('Cleaning up previous seed data...');
    const usersColl = db.collection('users');
    const employeesColl = db.collection('employees');
    const driversColl = db.collection('drivers');
    const tenantsColl = db.collection('tenants');
    const clientsColl = db.collection('clients');
    const gpsDevicesColl = db.collection('gpsdevices');
    const vehiclesColl = db.collection('vehicles');
    const vehicleDeviceMapsColl = db.collection('vehicledevicemaps');
    const driverVehicleAssignmentsColl = db.collection('drivervehicleassignments');
    const gpsAllocationsColl = db.collection('gpsallocations');

    await usersColl.deleteMany({ email: { $regex: /^(tenant|client|driver|technician|salesperson|suresh\.gupta)/i } });
    await employeesColl.deleteMany({ email: { $regex: /^(tenant|client|driver|technician|salesperson|suresh\.gupta)/i } });
    await driversColl.deleteMany({ email_id: { $regex: /^(tenant|client|driver|technician|salesperson)/i } });
    await tenantsColl.deleteMany({ tenant_id: { $regex: /^tenant\d+$/ } });
    await clientsColl.deleteMany({ email_id: { $regex: /^client\d+/i } });
    await gpsDevicesColl.deleteMany({ device_id: { $regex: /^GPS-DEV-/ } });
    await vehiclesColl.deleteMany({ registration_number: { $regex: /^MH-12-XX-/ } });
    await vehicleDeviceMapsColl.deleteMany({ installation_notes: "Seeded mapping" });
    await driverVehicleAssignmentsColl.deleteMany({ instructions: "Seeded assignment" });
    await gpsAllocationsColl.deleteMany({ unallocatedDate: null }); // clean allocations

    console.log('Cleanup completed!');

    // 3. Create Superadmin User
    console.log('Creating Superadmin...');
    const saEmpId = new mongoose.Types.ObjectId();
    await employeesColl.insertOne({
      _id: saEmpId,
      name: 'Suresh Gupta',
      email: 'suresh.gupta@nutantek.com',
      mobile_number: '9988776655',
      designation: 'Super Admin',
      scope: 'system',
      created_at: new Date(),
      updated_at: new Date()
    });

    await usersColl.insertOne({
      employee_id: saEmpId,
      email: 'suresh.gupta@nutantek.com',
      password: hashedPassword,
      role: superAdminRole._id,
      scope: 'system'
    });
    console.log('Superadmin created!');

    // 4. Create 10 Tenants & 10 Clients, and all nested drivers, technician, salespersons & assignments
    for (let i = 1; i <= 10; i++) {
      console.log(`Seeding Tenant ${i} & Client ${i}...`);

      // Tenant
      const tenantDbId = new mongoose.Types.ObjectId();
      await tenantsColl.insertOne({
        _id: tenantDbId,
        tenant_id: `tenant${i}`,
        name: `Tenant ${i}`,
        domain: `tenant${i}.com`,
        auth_methods: ['local'],
        status: 'active',
        created_at: new Date(),
        // Adding unique fields to satisfy database legacy indexes
        tenant_short_name: `ten${i}`,
        tenant_cin: `L01234MH2026TEN00000${i}`,
        tenant_gstn: `27GSTNTEN00000${i}`
      });

      // Tenant Admin User
      const tenantAdminEmpId = new mongoose.Types.ObjectId();
      await employeesColl.insertOne({
        _id: tenantAdminEmpId,
        name: `Tenant Admin ${i}`,
        email: `tenant${i}@gmail.com`,
        mobile_number: `911234560${i}`,
        designation: 'Tenant Admin',
        scope: 'tenant',
        tenant_id: tenantDbId,
        created_at: new Date(),
        updated_at: new Date()
      });

      await usersColl.insertOne({
        employee_id: tenantAdminEmpId,
        email: `tenant${i}@gmail.com`,
        password: hashedPassword,
        role: tenantAdminRole._id,
        scope: 'tenant',
        tenant_id: tenantDbId
      });

      // Tenant User (tenantuser1@gmail.com to tenantuser10@gmail.com)
      const tenantUserEmpId = new mongoose.Types.ObjectId();
      await employeesColl.insertOne({
        _id: tenantUserEmpId,
        name: `Tenant User ${i}`,
        email: `tenantuser${i}@gmail.com`,
        mobile_number: `911234570${i}`,
        designation: 'Tenant User',
        scope: 'tenant',
        tenant_id: tenantDbId,
        created_at: new Date(),
        updated_at: new Date()
      });

      await usersColl.insertOne({
        employee_id: tenantUserEmpId,
        email: `tenantuser${i}@gmail.com`,
        password: hashedPassword,
        role: tenantUserRole._id,
        scope: 'tenant',
        tenant_id: tenantDbId
      });

      // Tenant Salesperson (salesperson1@gmail.com to salesperson10@gmail.com)
      const salespersonEmpId = new mongoose.Types.ObjectId();
      await employeesColl.insertOne({
        _id: salespersonEmpId,
        name: `Salesperson ${i}`,
        email: `salesperson${i}@gmail.com`,
        mobile_number: `911234580${i}`,
        designation: 'Salesperson',
        scope: 'tenant',
        tenant_id: tenantDbId,
        created_at: new Date(),
        updated_at: new Date()
      });

      const salespersonUserId = new mongoose.Types.ObjectId();
      await usersColl.insertOne({
        _id: salespersonUserId,
        employee_id: salespersonEmpId,
        email: `salesperson${i}@gmail.com`,
        password: hashedPassword,
        role: salespersonRole._id,
        scope: 'tenant',
        tenant_id: tenantDbId
      });

      // Client Profile
      const clientDbId = new mongoose.Types.ObjectId();
      await clientsColl.insertOne({
        _id: clientDbId,
        tenant_id: tenantDbId,
        entity_name: `Client ${i}`,
        contact_name: `Client Contact ${i}`,
        gst_number: `27AAAAA0000A1Z${i}`,
        cin_number: `L01110MH2026PLC00000${i}`,
        address1: `Unit ${i}, Tech Park`,
        city: 'Mumbai',
        district: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        mobile_number: `922234560${i}`,
        email_id: `client${i}@gmail.com`,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Client Admin User (client1@gmail.com)
      const clientAdminEmpId = new mongoose.Types.ObjectId();
      await employeesColl.insertOne({
        _id: clientAdminEmpId,
        name: `Client Admin ${i}`,
        email: `client${i}@gmail.com`,
        mobile_number: `922234560${i}`,
        designation: 'Client Admin',
        scope: 'client',
        tenant_id: tenantDbId,
        client_profile_id: clientDbId,
        created_at: new Date(),
        updated_at: new Date()
      });

      await usersColl.insertOne({
        employee_id: clientAdminEmpId,
        email: `client${i}@gmail.com`,
        password: hashedPassword,
        role: clientAdminRole._id,
        scope: 'client',
        tenant_id: tenantDbId,
        client_profile_id: clientDbId
      });

      // Client User (clientuser1@gmail.com to clientuser10@gmail.com)
      const clientUserEmpId = new mongoose.Types.ObjectId();
      await employeesColl.insertOne({
        _id: clientUserEmpId,
        name: `Client User ${i}`,
        email: `clientuser${i}@gmail.com`,
        mobile_number: `922234570${i}`,
        designation: 'Client User',
        scope: 'client',
        tenant_id: tenantDbId,
        client_profile_id: clientDbId,
        created_at: new Date(),
        updated_at: new Date()
      });

      await usersColl.insertOne({
        employee_id: clientUserEmpId,
        email: `clientuser${i}@gmail.com`,
        password: hashedPassword,
        role: clientManagerRole._id, // Map clientuser to client_manager role
        scope: 'client',
        tenant_id: tenantDbId,
        client_profile_id: clientDbId
      });

      // Client Technician (technician1@gmail.com to technician10@gmail.com)
      const technicianEmpId = new mongoose.Types.ObjectId();
      await employeesColl.insertOne({
        _id: technicianEmpId,
        name: `Technician ${i}`,
        email: `technician${i}@gmail.com`,
        mobile_number: `922234580${i}`,
        designation: 'Technician',
        scope: 'client',
        tenant_id: tenantDbId,
        client_profile_id: clientDbId,
        created_at: new Date(),
        updated_at: new Date()
      });

      const technicianUserId = new mongoose.Types.ObjectId();
      await usersColl.insertOne({
        _id: technicianUserId,
        employee_id: technicianEmpId,
        email: `technician${i}@gmail.com`,
        password: hashedPassword,
        role: technicianRole._id,
        scope: 'client',
        tenant_id: tenantDbId,
        client_profile_id: clientDbId
      });

      // GPS Device
      const gpsDeviceDbId = new mongoose.Types.ObjectId();
      const devId = `GPS-DEV-${i}`;
      await gpsDevicesColl.insertOne({
        _id: gpsDeviceDbId,
        imei: `12345678901234${i}`,
        device_id: devId,
        icc_id: `899112345678901234${i}`,
        make: 'Teltonika',
        model: 'FMB920',
        firmware_version: 'V1.0',
        protocol: 'codec8',
        status: 'ACTIVE',
        device_type: 'GPS',
        created_at: new Date()
      });

      // Allocate GPS to Technician & Salesperson (via GpsAllocation)
      await gpsAllocationsColl.insertOne({
        technicianId: technicianUserId,
        gpsId: gpsDeviceDbId,
        allocatedDate: new Date(),
        unallocatedDate: null
      });

      // Vehicle
      const vehicleDbId = new mongoose.Types.ObjectId();
      await vehiclesColl.insertOne({
        _id: vehicleDbId,
        client_id: clientDbId,
        make: 'Mahindra',
        model: 'Bolero Pick-up',
        availability_place: 'Mumbai Depot',
        registration_number: `MH-12-XX-100${i}`,
        manufacturing_year: 2025,
        chassis_number: `CHASSISNUM${i}98765`,
        engine_number: `ENGINENUM${i}54321`,
        date_of_subscription: new Date(),
        regn_valid_upto: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        created_at: new Date()
      });

      // Vehicle Device Map (MAPPED)
      await vehicleDeviceMapsColl.insertOne({
        vehicle_id: vehicleDbId,
        gps_device_id: gpsDeviceDbId,
        technician_id: `tech-${i}`,
        installation_date: new Date(),
        installation_notes: 'Seeded mapping',
        status: 'MAPPED'
      });

      // Driver
      const driverDbId = new mongoose.Types.ObjectId();
      await driversColl.insertOne({
        _id: driverDbId,
        driver_name: `Driver ${i}`,
        driver_license: `DL-${i}99887766`,
        mobile_number: `933234560${i}`,
        email_id: `driver${i}@gmail.com`,
        user_id: `driver${i}@gmail.com`,
        created_at: new Date()
      });

      // Driver User Account
      const driverEmpId = new mongoose.Types.ObjectId();
      await employeesColl.insertOne({
        _id: driverEmpId,
        name: `Driver ${i}`,
        email: `driver${i}@gmail.com`,
        mobile_number: `933234560${i}`,
        designation: 'Driver',
        scope: 'client',
        tenant_id: tenantDbId,
        client_profile_id: clientDbId,
        created_at: new Date(),
        updated_at: new Date()
      });

      await usersColl.insertOne({
        employee_id: driverEmpId,
        email: `driver${i}@gmail.com`,
        password: hashedPassword,
        role: driverRole._id,
        scope: 'client',
        tenant_id: tenantDbId,
        client_profile_id: clientDbId,
        // fields for driver controllers
        user_id: `driver${i}@gmail.com`,
        driver_id: driverDbId
      });

      // Driver Vehicle Assignment (ACTIVE)
      await driverVehicleAssignmentsColl.insertOne({
        client_id: clientDbId,
        driver_id: driverDbId,
        vehicle_id: vehicleDbId,
        route_id: null,
        from_datetime: new Date(),
        to_datetime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // active for 1 year
        instructions: 'Seeded assignment',
        status: 'ACTIVE'
      });
    }

    console.log('\nAll data seeded successfully!');
    await mongoose.disconnect();
    console.log('Database disconnected cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal Seeding Error:', err);
    process.exit(1);
  }
}

seed();
