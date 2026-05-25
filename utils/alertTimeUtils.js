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

function parseAlertDateTime(dateTimeStr) {
    if (!dateTimeStr || typeof dateTimeStr !== "string") {
        throw new Error("Invalid date-time");
    }

    const match = dateTimeStr.trim().match(
        /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i
    );

    if (!match) {
        throw new Error(
            'Expected format: "DD/MM/YYYY hh:mm AM/PM"'
        );
    }

    let [, day, month, year, rawHours, minutes, period] = match;

    let hours = parseInt(rawHours, 10);
    period = period.toUpperCase();

    if (period === "AM" && hours === 12) hours = 0;
    if (period === "PM" && hours !== 12) hours += 12;

    const pad = (n) => String(n).padStart(2, "0");

    const isoString =
        `${year}-${month}-${day}T${pad(hours)}:${minutes}:00${IST_OFFSET}`;

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
    if (!date || isNaN(date)) return null;

    return new Date(date)
        .toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        })
        .toUpperCase();
}


module.exports = { parseAlertDateTime, formatAlertTime, formatAlertDateTime };
