/**
 * alertTimeUtils.js
 * Converts between:
 *   - Frontend: 12-hour IST string  →  "08:30 AM" / "06:45 PM"
 *   - Database:  UTC Date object    →  2026-05-25T03:00:00.000Z
 */

const IST_OFFSET = "+05:30";

/**
 * Parses a 12-hour IST time string into a UTC Date object.
 * Uses today's date (in IST) as the base date.
 *
 * @param {string} timeStr  e.g. "08:30 AM" or "6:45 PM"
 * @returns {Date}          UTC Date (stored in MongoDB as UTC)
 *
 * Example:
 *   parseAlertTime("08:30 AM")
 *   → treats as 08:30 IST on today's date
 *   → stores as 03:00 UTC in DB
 */
function parseAlertTime(timeStr) {
    if (!timeStr || typeof timeStr !== "string") {
        throw new Error(`Invalid time: expected a string like "08:30 AM", got: ${timeStr}`);
    }

    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
        throw new Error(`Invalid time format: "${timeStr}". Expected "HH:MM AM" or "HH:MM PM"`);
    }

    let [, rawHours, rawMinutes, period] = match;
    let hours = parseInt(rawHours, 10);
    const minutes = parseInt(rawMinutes, 10);
    period = period.toUpperCase();

    if (hours < 1 || hours > 12) throw new Error("Hours must be between 1 and 12");
    if (minutes < 0 || minutes > 59) throw new Error("Minutes must be between 0 and 59");

    // Convert 12-hour to 24-hour
    if (period === "AM" && hours === 12) hours = 0;   // 12:xx AM → 0:xx
    if (period === "PM" && hours !== 12) hours += 12; // x:xx PM  → (x+12):xx

    const pad = (n) => String(n).padStart(2, "0");

    // Get today's date string in IST (e.g. "2026-05-25")
    const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    // Build ISO 8601 string with IST offset — JS will correctly convert to UTC internally
    const isoString = `${todayIST}T${pad(hours)}:${pad(minutes)}:00${IST_OFFSET}`;

    return new Date(isoString);
}

/**
 * Formats a UTC Date object into a 12-hour IST time string.
 *
 * @param {Date} date   UTC Date from MongoDB
 * @returns {string}    e.g. "08:30 AM" or "06:45 PM"
 *
 * Example:
 *   formatAlertTime(new Date("2026-05-25T03:00:00.000Z"))
 *   → "08:30 AM"
 */
function formatAlertTime(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) return null;

    return date
        .toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        })
        .toUpperCase()           // ensure "AM"/"PM" uppercase
        .replace(/\s+/g, " ")   // normalize whitespace
        .trim();
}

/**
 * Formats a UTC Date object into a full IST date-time string.
 *
 * @param {Date} date   UTC Date from MongoDB
 * @returns {string}    e.g. "25/05/2026, 08:30 AM"
 */
function formatAlertDateTime(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) return null;

    return date
        .toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        })
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim();
}

module.exports = { parseAlertTime, formatAlertTime, formatAlertDateTime };
