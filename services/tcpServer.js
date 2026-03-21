/* Commented on 20/03/2026 
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

tcpServer.listen(3007, '0.0.0.0', () => {
  console.log('TCP server listening on port 3007  ');
});

module.exports = tcpServer;
*/

// 20/03/2026
// services/tcpServer.js

require("dotenv").config();
const net = require("net");
const connectDB = require("../config/db");   // import existing db connection
const GPSRawData = require("../models/gpsRawData");

// Initialize MongoDB connection once when service starts
connectDB();

// Utility: timestamped logger
function log(level, message, err = null) {
  const ts = new Date().toISOString();
  if (err) {
    console.error(`[${ts}] [${level}] ${message}`, err);
  } else {
    console.log(`[${ts}] [${level}] ${message}`);
  }
}

// Create TCP server
const tcpServer = net.createServer(socket => {
  log("INFO", "GPS device connected");

  // Enable TCP keep-alive to prevent idle disconnects
  socket.setKeepAlive(true, 60000); // send keep-alive every 60s

  // Handle incoming data
  socket.on("data", async data => {
    try {
      // Convert buffer to string and parse JSON
      const raw = JSON.parse(data.toString()); // replace with real parser for GPS protocol

      // Save raw packet to MongoDB
      const gpsRaw = new GPSRawData({
        imei: raw.imei,
        raw_payload: raw,
        raw_data: Buffer.from(data)
      });

      await gpsRaw.save();
      log("INFO", `Raw GPS packet stored: ${gpsRaw._id}`);
    } catch (err) {
      log("ERROR", "Error parsing GPS packet", err);
    }
  });

  // Handle socket errors
  socket.on("error", err => {
    log("ERROR", "Socket error", err);
  });

  // Handle client disconnect
  socket.on("close", () => {
    log("INFO", "GPS device disconnected");
  });
});

// Handle server-level errors
tcpServer.on("error", err => {
  log("ERROR", "TCP server error", err);
});

// Start listening
tcpServer.listen(3007, "0.0.0.0", () => {
  log("INFO", "TCP server listening on port 3007");
});

// Global uncaught exception handler (prevents crash)
process.on("uncaughtException", err => {
  log("FATAL", "Uncaught exception", err);
});

// Global unhandled promise rejection handler
process.on("unhandledRejection", err => {
  log("FATAL", "Unhandled promise rejection", err);
});

module.exports = tcpServer;

