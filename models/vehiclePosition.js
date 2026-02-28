// /models/vehiclePosition.js

const mongoose = require('mongoose'); 
const vehiclePositionSchema = new mongoose.Schema({ 
    vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true }, 
    location: { 
        type: { 
            type: String, 
            enum: ['Point'], 
            required: true 
        }, 
        coordinates: { type: [Number], required: true } // [lng, lat] 
        }, 
        speed: { type: Number }, 
        heading: { type: Number }, 
        timestamp: { type: Date, default: Date.now } 
    }); 
    
    vehiclePositionSchema.index({ location: '2dsphere' }); 
    
    module.exports = mongoose.model('VehiclePosition', vehiclePositionSchema);
