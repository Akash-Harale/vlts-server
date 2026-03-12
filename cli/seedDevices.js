require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const GPSDevice = require('../models/gpsDevice');
const Vehicle = require('../models/vehicle');
const VehicleDeviceMap = require('../models/vehicleDeviceMap');

const imeis = ['356938035643809', '356938035643810', '356938035643811'];

async function seed() {
  await connectDB();
  
  for (let i = 0; i < imeis.length; i++) {
    const imei = imeis[i];
    
    let device = await GPSDevice.findOne({ imei });
    if (!device) {
      device = await GPSDevice.create({
        imei,
        serial_number: 'SN-' + imei,
        manufacturer: 'TestM',
        model: 'TestMod',
        status: 'ACTIVE'
      });
      console.log('Created GPS Device:', imei);
    } else {
      device.status = 'ACTIVE';
      await device.save();
    }
    
    const reg = 'DL01AB' + (1000 + i);
    let vehicle = await Vehicle.findOne({ registration_number: reg });
    if (!vehicle) {
      vehicle = await Vehicle.create({
        make: 'Tata',
        model: 'Nexon',
        registration_number: reg,
        manufacturing_year: 2024
      });
      console.log('Created Vehicle:', reg);
    }
    
    let map = await VehicleDeviceMap.findOne({ vehicle_id: vehicle._id, status: 'MAPPED' });
    if (!map) {
      // remove old mapping if any
      await VehicleDeviceMap.updateMany({ gps_device_id: device._id }, { status: 'UNMAPPED' });
      map = await VehicleDeviceMap.create({
        vehicle_id: vehicle._id,
        gps_device_id: device._id,
        status: 'MAPPED'
      });
      console.log('Mapped Vehicle', reg, 'to IMEI', imei, ' vehicle_id:', vehicle._id.toString());
    } else {
      console.log('Already Mapped Vehicle', reg, 'to IMEI', imei, ' vehicle_id:', vehicle._id.toString());
    }
  }
  
  console.log('Seed complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
