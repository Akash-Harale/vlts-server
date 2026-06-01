const mongoose = require("mongoose");

const TempRouteSchema = new mongoose.Schema({
    client_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ClientProfile",
        required: true
    },
    driver_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Driver",
        required: true
    },
    vehicle_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vehicle",
        required: true
    },
    route_name: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ["created", "submitted", "approved"],
        default: "created"
    },
}, {
    timestamps: true
});

module.exports = mongoose.model("TempRoute", TempRouteSchema);

const TempRoute = mongoose.model("TempRoute", TempRouteSchema)

module.exports = { TempRoute }