require("dotenv").config();
const net = require("net");
const connectDB = require("../config/db");   // import existing db connection
const GPSRawData = require("../models/gpsRawData");
const { parseGpsPacket } = require("../utils/gpsParser");

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
	  const rawStr = data.toString("ascii").trim();
    try {
      console.log('raw str: ', rawStr);

      // Parse raw string  to JSON	
      const parsed = parseGpsPacket(rawStr);

      // Save raw packet to MongoDB
      const gpsRaw = new GPSRawData({
        imei: parsed.imei,
        raw_payload: parsed.payload,
        raw_data: data
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
