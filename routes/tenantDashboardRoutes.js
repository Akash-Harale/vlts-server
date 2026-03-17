const express = require('express');
const router = express.Router();
const tenantDashboardController = require('../controllers/tenantDashboardController');
const authMiddleware = require('../middleware/authMiddleware');

const authorize = require('../middleware/authorize');

// Client Routes
router.get('/clients', authMiddleware(), authorize('clients', 'read'), tenantDashboardController.getClients);
router.post('/clients', authMiddleware(), authorize('clients', 'create'), tenantDashboardController.createClient);
router.put('/clients/:id', authMiddleware(), authorize('clients', 'update'), tenantDashboardController.updateClient);
router.delete('/clients/:id', authMiddleware(), authorize('clients', 'delete'), tenantDashboardController.deleteClient);

// Vehicle Routes
router.get('/vehicles', authMiddleware(), authorize('vehicles', 'read'), tenantDashboardController.getVehicles);
router.post('/vehicles', authMiddleware(), authorize('vehicles', 'create'), tenantDashboardController.createVehicle);
router.put('/vehicles/:id', authMiddleware(), authorize('vehicles', 'update'), tenantDashboardController.updateVehicle);
router.delete('/vehicles/:id', authMiddleware(), authorize('vehicles', 'delete'), tenantDashboardController.deleteVehicle);

// GPS Device Routes
router.get('/gps-devices', authMiddleware(), authorize('gps_devices', 'read'), tenantDashboardController.getGPSDevices);
router.post('/gps-devices', authMiddleware(), authorize('gps_devices', 'create'), tenantDashboardController.createGPSDevice);
router.put('/gps-devices/:id', authMiddleware(), authorize('gps_devices', 'update'), tenantDashboardController.updateGPSDevice);
router.delete('/gps-devices/:id', authMiddleware(), authorize('gps_devices', 'delete'), tenantDashboardController.deleteGPSDevice);

// Mapping Routes
router.post('/mapping/map', authMiddleware(), authorize('mapping', 'create'), tenantDashboardController.mapDevice);
router.post('/mapping/unmap', authMiddleware(), authorize('mapping', 'delete'), tenantDashboardController.unmapDevice);

module.exports = router;
