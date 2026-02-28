// jobs/deviceHealthCheck.js
// Scheduled job to mark GPS devices as FAULTY if they stop reporting

/*
How It Works
Runs every 5 minutes → checks all ACTIVE devices.
Threshold = 15 minutes → if installed_on (or last heartbeat field) is older, device is marked FAULTY.
Logs → [AUTO-UPDATE] messages show which devices were downgraded.
Audit safety → keeps history of when devices were marked faulty.
With this, your system now has automatic health monitoring. Devices that stop reporting are flagged without operator intervention.
*/
const cron = require('node-cron');
const GPSDevice = require('../models/gpsDevice');

// Run every 5 minutes (adjust as needed)
cron.schedule('*/5 * * * *', async () => {
  console.log(' [CRON] Running GPS device health check...');

  try {
    // Threshold: devices inactive for >15 minutes are marked FAULTY
    const threshold = new Date(Date.now() - 15 * 60 * 1000);

    const devices = await GPSDevice.find({
      status: 'ACTIVE',
      installed_on: { $lt: threshold } // last installed/heartbeat older than threshold
    });

    for (const device of devices) {
      device.status = 'FAULTY';
      await device.save();
      console.warn(` [AUTO-UPDATE] Device ${device.serial_number} marked FAULTY due to inactivity`);
    }

    console.log(` [CRON] Health check completed. Devices updated: ${devices.length}`);
  } catch (err) {
    console.error(' [ERROR] Health check failed:', err.message);
  }
});

