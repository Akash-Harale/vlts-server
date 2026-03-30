// services/tcpServer.js
// 23/03/2026

require("dotenv").config();
const net = require("net");
const connectDB = require("../config/db");
const NavitechGpsRawData = require("../models/navitechGpsRawData");

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
      // Convert buffer to string exactly as received
      const rawStr = data.toString("ascii").trim();

      // Print raw data in multiple views
      console.log("=== RAW GPS DATA (ASCII String) ===");
      console.log(rawStr);
      console.log("=== RAW GPS DATA (Hex Dump) ===");
      console.log(data.toString("hex"));

      // AIS-140 framing check
      if (rawStr.startsWith("$") && rawStr.includes("*")) {
        const headerSection = rawStr.split(",")[0]; // "$Header"
        console.log("=== AIS-140 HEADER SECTION ===");
        console.log(headerSection);
      } else {
        console.log("WARNING: Incoming packet does not match AIS-140 framing");
      }

      // Save raw packet + header to MongoDB
      const gpsRaw = new NavitechGpsRawData({
        raw_data: Buffer.from(data),
        header: rawStr.split(",")[0],
        received_at: new Date()
      });

      await gpsRaw.save();
      log("INFO", `Raw GPS packet stored: ${gpsRaw._id}`);
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
