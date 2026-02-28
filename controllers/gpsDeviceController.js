// controllers/gpsDeviceController.js
// Handles CRUD operations for GPS devices with debug logs

const GPSDevice = require('../models/gpsDevice');

// POST /gps-devices → Add new GPS device
exports.addDevice = async (req, res) => {
  console.log(' [DEBUG] AddDevice request body:', req.body);
  try {
    const device = new GPSDevice(req.body);
    await device.save();
    console.log(' [DEBUG] Device saved:', device);
    res.status(201).json(device);
  } catch (err) {
    console.error(' [ERROR] AddDevice failed:', err.message);
    res.status(400).json({ error: err.message });
  }
};

// GET /gps-devices → View all devices
exports.getDevices = async (req, res) => {
  console.log(' [DEBUG] Fetching all devices');
  try {
    const devices = await GPSDevice.find();
    console.log(' [DEBUG] Devices found:', devices.length);
    res.json(devices);
  } catch (err) {
    console.error(' [ERROR] GetDevices failed:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /gps-devices/:id → View single device
exports.getDeviceById = async (req, res) => {
  console.log(' [DEBUG] Fetching device by ID:', req.params.id);
  try {
    const device = await GPSDevice.findById(req.params.id);
    if (!device) {
      console.warn(' [WARN] Device not found:', req.params.id);
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device);
  } catch (err) {
    console.error(' [ERROR] GetDeviceById failed:', err.message);
    res.status(500).json({ error: err.message });
  }
};


// PUT /gps-devices/:id → Edit device
exports.updateDevice = async (req, res) => {
  console.log(' [DEBUG] Updating device ID:', req.params.id, 'with data:', req.body);
  try {
    const device = await GPSDevice.findById(req.params.id);

    if (!device) {
      console.warn(' [WARN] Device not found for update:', req.params.id);
      return res.status(404).json({ error: 'Device not found' });
    }

    // Apply updates safely
    Object.assign(device, req.body);

    // Trigger self-healing validation
    await device.save();

    console.log(' [DEBUG] Device updated:', {
      id: device._id,
      imei: device.imei,
      status: device.status,
    });

    res.json({
      message: 'Device updated successfully',
      device,
    });
  } catch (err) {
    console.error(' [ERROR] UpdateDevice failed:', err.message);
    res.status(400).json({ error: err.message });
  }
};

// DELETE /gps-devices/:id → Delete device
exports.deleteDevice = async (req, res) => {
  console.log(' [DEBUG] Deleting device ID:', req.params.id);
  try {
    const device = await GPSDevice.findById(req.params.id);

    if (!device) {
      console.warn(' [WARN] Device not found for delete:', req.params.id);
      return res.status(404).json({ error: 'Device not found' });
    }

    await device.deleteOne();

    console.log(' [DEBUG] Device deleted:', {
      id: device._id,
      imei: device.imei,
    });

    res.json({
      message: 'Device deleted successfully',
      deleted_id: device._id,
    });
  } catch (err) {
    console.error(' [ERROR] DeleteDevice failed:', err.message);
    res.status(500).json({ error: err.message });
  }
};


/*

// Heartbeat endpoint for GPS devices

Deployment Flow
Backend API → hosted on your server/cloud (e.g., NIC cloud, AWS, Azure).
Device firmware → configured with your server’s IP/domain + port.
Device ping → sends heartbeat packets to your backend.
Backend updates DB → marks device as alive, resets failed attempts.
Cron job → checks if last ping > threshold → marks device FAULTY.


The API is deployed on your backend server.
The device firmware is configured to call that API at intervals.
The backend updates the device’s last_seen timestamp, which your health check job uses to decide if the device is alive or faulty.

*/
// POST /gps-devices/:id/heartbeat
/*
Sample Heartbeat Payload (JSON)
{
  "imei": "356938035643809",                 // Unique device IMEI
  "vehicle_registration_number": "UP32AB1234", // Vehicle identity
  "timestamp": "2026-01-27T18:00:00Z",       // UTC timestamp of heartbeat
  "coordinates": {
    "latitude": 28.6139,
    "longitude": 77.2090
  },
  "speed": 45.2,                            // Current speed in km/h
  "heading": 90.0,                          // Direction in degrees
  "altitude": 210.0,                        // Altitude in meters
  "status_flags": {
    "panic_button": false,                  // Emergency button pressed?
    "tamper_detected": false,               // Device tamper status
    "overspeed": false,                     // Overspeed flag
    "device_health": "OK"                   // Health status
  },
  "network": {
    "signal_strength": -82,                 // GSM RSSI in dBm
    "operator": "Airtel-IN"                 // Cellular operator
  }
}

POST https://yourserver.com/gps-devices/<DEVICE_ID>/heartbeat


How It Works
Device firmware sends this payload via HTTP POST to your backend:

POST https://yourserver.com/gps-devices/<DEVICE_ID>/heartbeat

Backend API updates the device’s installed_on or last_seen timestamp.
Health check cron job uses this timestamp to decide if the device is alive or should be marked FAULTY.
Operators can see logs like [DEBUG] Heartbeat received from device: ... for audit clarity.
*/

// POST /gps-devices/:id/heartbeat
exports.heartbeat = async (req, res) => {
  console.log(' [DEBUG] Heartbeat received from device:', req.params.id, 'payload:', req.body);
  try {
    const device = await GPSDevice.findById(req.params.id);
    if (!device) {
      console.warn(' [WARN] Device not found:', req.params.id);
      return res.status(404).json({ error: 'Device not found' });
    }

    // Update last seen timestamp
    device.installed_on = new Date();

    // Reset failed attempts on successful heartbeat
    device.failed_attempts = 0;

    await device.save();

    console.log(` [HEARTBEAT OK] Device ${device.serial_number} is alive at ${device.installed_on}`);

    res.json({
      message: 'Heartbeat acknowledged',
      status: device.status,
      last_seen: device.installed_on
    });
  } catch (err) {
    console.error(' [ERROR] Heartbeat failed:', err.message);
    res.status(500).json({ error: err.message });
  }
};
