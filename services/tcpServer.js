// services/tcpServer.js
require("dotenv").config();
const net = require('net');
const connectDB = require('../config/db');   // import existing db connection
const GPSRawData = require('../models/gpsRawData');

// Initialize MongoDB connection once when service starts
connectDB();

const tcpServer = net.createServer(socket => {
    console.log('GPS device connected');

    socket.on('data', async data => {
        try {
            const raw = JSON.parse(data.toString()); // replace with real parser
            const gpsRaw = new GPSRawData({
                imei: raw.imei,
                raw_payload: raw,
                raw_data: Buffer.from(data)
            });
            await gpsRaw.save();
            console.log('Raw GPS packet stored:', gpsRaw._id);
        } catch (err) {
            console.error('Error parsing GPS packet:', err.message);
        }
    });
});

tcpServer.listen(5000, () => {
    console.log('TCP server listening on port 5000');
});

module.exports = tcpServer;
