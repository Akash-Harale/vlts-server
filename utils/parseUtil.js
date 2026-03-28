    // parserUtil.js
    // 28 March 2026

    function parsePacket(rawPacket) {
    const fields = rawPacket.split(",").map(f => f.trim());

    // LOGIN PACKET
    if (fields[7] === "AIS140") {
        return {
        data_type: "Login",
        imei: fields[5],
        parsed_fields: fields.map((val, idx) => ({ index: idx, value: val }))
        };
    }

    // EMERGENCY PACKET
    if (fields[2] === "EMR" || fields[2] === "SEM") {
        return {
        data_type: "Emergency",
        imei: fields[3],
        parsed_fields: fields.map((val, idx) => ({ index: idx, value: val }))
        };
    }

    // TRACKING PACKET
    const packetTypes = ["NR","EA","TA","HP","IN","IF","BD","BR","BL"];
    if (packetTypes.includes(fields[4])) {
        return {
        data_type: "Tracking",
        imei: fields[7],
        parsed_fields: fields.map((val, idx) => ({ index: idx, value: val }))
        };
    }

    // HEALTH PACKET — exact field mapping
    if (fields.length == 13 && fields[7] !== "AIS140") {
        return {
        data_type: "Health",
        imei: fields[3],
        parsed_fields: [
            { index: 0, field: "header", value: fields[0] },
            { index: 1, field: "vendor_id", value: fields[1] },
            { index: 2, field: "firmware_version", value: fields[2] },
            { index: 3, field: "imei", value: fields[3] },
            { index: 4, field: "battery_percentage", value: fields[4] },
            { index: 5, field: "low_battery_threshold", value: fields[5] },
            { index: 6, field: "memory_percentage1", value: fields[6] },
            { index: 7, field: "memory_percentage2", value: fields[7] },
            { index: 8, field: "ignition_on_interval", value: fields[8] },
            { index: 9, field: "ignition_off_interval", value: fields[9] },
            { index: 10, field: "digital_inputs", value: fields[10] },
            { index: 11, field: "analog_input1", value: fields[11] },
            { index: 12, field: "analog_input2_checksum", value: fields[12] }
        ]
        };
    }

    return { data_type: "Unknown", imei: null, parsed_fields: fields.map((val, idx) => ({ index: idx, value: val })) };
    }

    module.exports = { parsePacket };

