// 26-Feb-2026

// ./jobs/cronJob.js
const mongoose = require("mongoose");
const cron = require("node-cron");
const migrateAllBatches = require("../services/batchMigration");
const { audit, error } = require("../utils/logger");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/vlts", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Schedule the migration job
// Runs daily at 12:30 AM
cron.schedule("30 0 * * *", async () => {
  try {
    await audit("system", "cron", "startMigration", "Trip", "Starting nightly migration job", "success");
    await migrateAllBatches(100); // process in batches of 100 until all are migrated
  } catch (err) {
    await error("system", "cron", err, "NightlyMigration", null, null, 500);
  }
});

