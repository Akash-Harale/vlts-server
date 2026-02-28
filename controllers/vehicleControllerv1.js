// /controllers/.vehiclController.js
// Base version : Commented on 17th Feb after adding the logic of next_available_date

// Vehicles API → Register vehicles, assign drivers, list vehicles.

const Vehicle = require("../models/vehicle");

// Register a new vehicle
exports.registerVehicle = async (req, res) => {
  try {
    const { make, model, registration_number, manufacturing_year } = req.body;
    const vehicle = new Vehicle({
      make,
      model,
      registration_number,
      manufacturing_year,
    });
    await vehicle.save();
    res.status(201).json(vehicle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all vehicles
exports.getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find();
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get vehicle by ID or registration number
exports.getVehicleById = async (req, res) => {
  try {
    const { vehicle_id, registration_number } = req.query;

    let vehicle;
    if (vehicle_id) {
      vehicle = await Vehicle.findById(vehicle_id);
    } else if (registration_number) {
      vehicle = await Vehicle.findOne({ registration_number });
    } else {
      return res
        .status(400)
        .json({ error: "Provide either vehicle_id or registration_number" });
    }

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Optional: you can add validation here if needed
    // e.g. prevent empty registration_number, check format, uniqueness, etc.

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      id,
      { $set: updateData }, // only update provided fields
      {
        new: true, // return the updated document
        runValidators: true, // enforce schema validators
        omitUndefined: true, // skip undefined fields (safer)
      },
    );

    if (!updatedVehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      data: updatedVehicle,
    });
  } catch (err) {
    console.error("Update vehicle error:", err);

    // Mongoose duplicate key error (e.g. unique registration_number)
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate registration number - vehicle already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update vehicle",
      error: err.message,
    });
  }
};

exports.deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await Vehicle.findByIdAndDelete(id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle deleted successfully",
    });
  } catch (err) {
    console.error("Delete vehicle error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete vehicle",
      error: err.message,
    });
  }
};
