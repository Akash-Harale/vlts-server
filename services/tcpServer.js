// services/tcpServer.js
// 28/03/2026

require("dotenv").config();
const net = require("net");
const connectDB = require("../config/db");
const GpsData = require("../models/gpsData");   // unified schema
const { parsePacket } = require("../utils/parserUtil"); // parser utility

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

const tcpServer = net.createServer(socket => {
  log("INFO", "GPS device connected");
  socket.setKeepAlive(true, 60000);

  socket.on("data", async data => {
    try {
      // Convert buffer to ASCII string exactly as received
      const rawStr = data.toString("ascii").trim();

      // Print raw data in multiple views for debugging
      console.log("=== RAW GPS DATA (ASCII String) ===");
      console.log(rawStr);
      console.log("=== RAW GPS DATA (Hex Dump) ===");
      console.log(data.toString("hex"));

      // Parse packet immediately
      const parsed = parsePacket(rawStr);

      // Save raw + parsed together in unified schema
      const gpsDoc = new GpsData({
        raw_packet: rawStr,              // original string
        imei: parsed.imei,               // extracted IMEI
        data_type: parsed.data_type,     // Login, Tracking, Health, Emergency, Unknown
        parsed_fields: parsed.parsed_fields, // full audit trace {index, field, value}
        processed: false,                // enrichment flag
        received_at: new Date()
      });

      await gpsDoc.save();
      log("INFO", `GPS packet stored: ${gpsDoc._id} [${parsed.data_type}]: \nParsed Data: ${parsed}`);
    } catch (err) {
      log("ERROR", "Error storing GPS packet", err);
    }
  });

  socket.on("error", err => {
    log("ERROR", "Socket error", err);
  });

  socket.on("close", () => {
    log("INFO", "GPS device disconnected");
  });
});

tcpServer.on("error", err => {
  log("ERROR", "TCP server error", err);
});

tcpServer.listen(3007, "0.0.0.0", () => {
  log("INFO", "TCP server listening on port 3007");
});

process.on("uncaughtException", err => {
  log("FATAL", "Uncaught exception", err);
});

process.on("unhandledRejection", err => {
  log("FATAL", "Unhandled promise rejection", err);
});

module.exports = tcpServer;
