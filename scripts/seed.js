const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Resource = require('../models/resourceModel');
const Role = require('../models/roleModel');
const Tenant = require('../models/tenantModel');
const User = require('../models/userModel');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // 1. Seed Resources
        const resources = [
            { name: 'clients', description: 'Client companies managed by tenants' },
            { name: 'vehicles', description: 'Fleet vehicles' },
            { name: 'gps_devices', description: 'Hardware GPS trackers' },
            { name: 'mapping', description: 'Device to vehicle mappings' },
            { name: 'trips', description: 'Vehicle trip management' }
        ];

        for (const res of resources) {
            await Resource.findOneAndUpdate({ name: res.name }, res, { upsert: true, new: true });
            console.log(`Resource ${res.name} seeded`);
        }

        // 2. Seed Roles
        const roles = [
            { 
                name: 'super_admin', 
                scope: 'system', 
                privileges: ['all'], 
                remarks: 'System Super Admin (Global Access)' 
            },
            { 
                name: 'tenant_admin', 
                scope: 'tenant', 
                privileges: ['clients:*', 'vehicles:*', 'gps_devices:*', 'mapping:*', 'trips:*'], 
                remarks: 'Tenant Administrator (Full Control over their tenant)' 
            },
            { 
                name: 'client_admin', 
                scope: 'tenant', 
                privileges: ['vehicles:*', 'trips:*'], 
                remarks: 'Client Admin (Manage their own fleet and trips)' 
            },
            { 
                name: 'tenant_user', 
                scope: 'tenant', 
                privileges: ['vehicles:read', 'trips:read'], 
                remarks: 'Client Viewer (Read-only access to their fleet)' 
            }
        ];

        for (const role of roles) {
            await Role.findOneAndUpdate({ name: role.name }, role, { upsert: true, new: true });
            console.log(`Role ${role.name} seeded`);
        }

        const tenantAdminRole = await Role.findOne({ name: 'tenant_admin' });

        // 2. Seed a Test Tenant
        const testTenant = {
            tenant_id: 'test-tenant-001',
            name: 'NutanTek Test Corp',
            domain: 'nutantek.test',
            status: 'active'
        };

        const tenantDoc = await Tenant.findOneAndUpdate({ tenant_id: testTenant.tenant_id }, testTenant, { upsert: true, new: true });
        console.log(`Tenant ${testTenant.name} seeded`);

        // 3. Seed a Tenant Admin User
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const testUser = {
            emp_id: 'NT-ADMIN-001',
            email: 'admin@nutantek.test',
            password: hashedPassword,
            role: tenantAdminRole._id,
            tenant_id: tenantDoc._id
        };

        await User.findOneAndUpdate({ email: testUser.email }, testUser, { upsert: true, new: true });
        console.log(`Tenant Admin user seeded: ${testUser.email} / admin123`);

        console.log('Seeding completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
}
}

seed();
