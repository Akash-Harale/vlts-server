// /postionController.js
// Vehicle Positions API → Store GPS points, query live positions.

const VehiclePosition = require('../models/vehiclePosition');

// Store GPS point
exports.addPosition = async (req, res) => {
  try {
    const { vehicle_id, coordinates, speed, heading } = req.body;
    const position = new VehiclePosition({
      vehicle_id,
      location: { type: 'Point', coordinates },
      speed,
      heading
    });
    await position.save();
    res.status(201).json(position);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Query live positions
exports.getLivePositions = async (req, res) => {
  try {
    const positions = await VehiclePosition.find().populate('vehicle_id');
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

