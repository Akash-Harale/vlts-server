// server.js
/*
Key Improvements
Added cors middleware with configurable options:
origin: controlled via .env (CORS_ORIGIN=http://localhost:3000 for React frontend, or * for all).
methods: explicitly allowed HTTP methods.
allowedHeaders: ensures Authorization headers work for JWT.
credentials: enables cookies/sessions if needed.
Middleware order: cors → bodyParser → routes.
*/

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors"); // Import CORS middleware
const connectDB = require("./config/db"); // Import DB connection
const http = require("http");
//const startWebSocketServer = require("./services/wsServer");
const { startWebSocketServer } = require("./services/wsServer");
const { startEnrichmentLoop } = require("./workers/enrichmentWorker");  // 7 March 2026

const superAdminRoutes = require("./routes/superAdminRoutes");
const platformTenantRoutes = require("./routes/platformTenantRoutes");
const tenantAdminRoutes = require("./routes/tenantAdminRoutes");
const tenantUserAuthRoutes = require("./routes/tenantUserAuthRoutes");
const routeRoutes = require("./routes/routeRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const positionRoutes = require("./routes/positionRoutes");
const deviationRoutes = require("./routes/deviationRoutes");
const tripRoutes = require("./routes/tripRoutes");
const tripReplayRoutes = require("./routes/tripReplayRoutes");
const gpsAllocationRoutes = require("./routes/gpsAllocation.routes");

// Import route files
const driverRoutes = require("./routes/driverRoutes");
const driverVehicleRoutes = require("./routes/driverVehicleRoutes");
const ClientAuthRoutes = require("./routes/clientAuthRoutes");
const driverUserRoutes = require("./routes/driverUserRoutes");
const gpsDeviceRoutes = require("./routes/gpsDeviceRoutes");
const vehicleDeviceMapRoutes = require("./routes/vehicleDeviceMapRoutes");
const clientRoutes = require("./routes/clientsRoutes");
const archiveRoutes = require("./routes/archiveRoutes");

// 17/02/2026
const checkAvailabilityRoutes = require("./routes/checkAvailabilityRoutes");

// Date: 26/02/2026
const tripHistoryRoutes = require("./routes/tripHistoryRoutes");               // summary-level trip data
const tripHistoryEventsRoutes = require("./routes/tripHistoryEventsRoutes");   // event-level trip data
const tripHistoryEventsReplayRoutes = require("./routes/tripHistoryEventsReplayRoutes"); // replay events

// 28/02/2026
const gpsAlertRoutes = require("./routes/gpsAlertRoutes");
const telemetryRoutes = require("./routes/telemetryRoutes");
const telemetryStatsRoutes = require("./routes/telemetryStatsRoutes");
const telemetryDashboardRoutes = require("./routes/telemetryDashboardRoutes");

// Import health check job
require("./jobs/deviceHealthCheck");

const app = express();

// -------------------- Middleware --------------------
const allowedOrigins = process.env.CORS_ORIGIN.split(",");

const corsOptions = {
  origin: (origin, callback) => {
    // allow non-browser requests (Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error("Blocked by CORS:", origin);
    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json({
  limit: "50mb"
}));

// -------------------- Database --------------------
connectDB();

// -------------------- Routes --------------------
app.use("/api", routeRoutes);
app.use("/api/vehicle", vehicleRoutes);
app.use("/api", positionRoutes);
app.use("/api", deviationRoutes);
app.use("/api", tripReplayRoutes);
app.use("/api/gps-allocation", gpsAllocationRoutes);

// Route entries
app.use("/api", driverRoutes); // Driver CRUD
app.use("/api", driverVehicleRoutes); // Driver-Vehicle Assignment CRUD

app.use("/api/driver", driverRoutes); // Driver CRUD
app.use("/api/trip", tripRoutes);
app.use("/api/client-auth", ClientAuthRoutes);
app.use("/api/", driverUserRoutes);

app.use("/api/gps", gpsDeviceRoutes);
//app.use("/vehicle-device-map", vehicleDeviceMapRoutes);
// get all assigned gps to vehicle
app.use("/api", vehicleDeviceMapRoutes);
// CRUD- Client
app.use("/api/clients", clientRoutes);
// Root endpoint
app.get("/", (req, res) => {
  res.send("Fleet Management API is running...");
});

app.use('/api/auth/superadmin', superAdminRoutes);       // Super Admin APIs
app.use('/api/platform/tenants', platformTenantRoutes);  // Tenant lifecycle mgmt (Super Admin only)
app.use('/api/auth/tenantadmin', tenantAdminRoutes);     // Tenant Admin APIs
app.use('/api/auth/tenantuser', tenantUserAuthRoutes);   // Tenant User APIs

app.use("/api", archiveRoutes);

// 17/02/2026
app.use("/api/checkavailability", checkAvailabilityRoutes);

// 26/02/2026
app.use("/api", tripHistoryRoutes);
app.use("/api", tripHistoryEventsRoutes);
app.use("/api", tripHistoryEventsReplayRoutes);

// 28/02/2026
app.use("/api/gpsalerts", gpsAlertRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/telemetry/stats", telemetryStatsRoutes);
app.use("/api/telemetry/dashboard", telemetryDashboardRoutes);

console.log("[server] Routes mounted: ");

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// -------------------- Server --------------------
const server = http.createServer(app);

// Start WebSocket server
const wss = startWebSocketServer(server);

// Kick off enrichment loop with access to wss
startEnrichmentLoop(wss);

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`Server + WebSocket running on port ${PORT}`);
});

/* package.json keywords

Notes
express → Web framework.

mongoose → ODM for MongoDB.

axios → Fetch routes from OpenStreetMap/OSRM.

@turf/turf → Geospatial buffer for geofences.

nodemailer → Email alerts via SMTP.

cors → Cross‑origin requests.

dotenv → Environment variables.

body-parser → JSON parsing middleware.

nodemon → Dev auto‑restart.

*/
