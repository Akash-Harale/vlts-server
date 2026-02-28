// /controllers/vehicleController.js
// Vehicles API → Register vehicles, assign drivers, list vehicles.

const Vehicle = require("../models/vehicle");
const VehicleState = require("../models/vehicleState");
const DriverVehicleAssignment = require("../models/driverVehicleAssignment");

// CREATE Vehicle
exports.registerVehicle = async (req, res) => {
  try {
    const { 
      make, 
      model, 
      registration_number, 
      manufacturing_year, 
      status,
      availability_place, 
      next_available_date 
    } = req.body;

    console.log('vehicleController: registerVehicle: req.body: ', req.body);
    if (!next_available_date) {
      return res.status(400).json({ success: false, message: "next_available_date is required" });
    }

    const inputDate = new Date(next_available_date);
    const today = new Date();

    if (inputDate <= today) {
      return res.status(400).json({
        success: false,
        message: `next_available_date must be greater than today's date/time`
      });
    }

    const vehicle = new Vehicle({
      make,
      model,
      registration_number,
      manufacturing_year,
    });
    await vehicle.save();

    const vehicleState = new VehicleState({
      vehicle_id: vehicle._id,
      place_of_availability: availability_place,
      next_available_date: inputDate,
      status: status.toUpperCase()
    });
    await vehicleState.save();

    res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      vehicle,
      availability_place,
      next_available_date,
      status
    });
  } catch (err) {
    console.log('vehicleController: registerVehicle: error: ', err.message);
    res.status(500).json({ error: err.message });
  }
};


// Get all vehicles (include next_available_date)
exports.getVehicles = async (req, res) => {
  try {
    const states = await VehicleState.find().populate("vehicle_id");

    const result = states.map((vs) => ({
      vehicleId: vs?.vehicle_id?._id,
      registration_number: vs?.vehicle_id?.registration_number,
      make: vs?.vehicle_id?.make,
      model: vs?.vehicle_id?.model,
      manufacturing_year: vs?.vehicle_id?.manufacturing_year,
      place_of_availability: vs?.place_of_availability,
      next_available_date: vs?.next_available_date,
      status: vs?.status,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get vehicle by ID or registration number (include next_available_date)
exports.getVehicleById = async (req, res) => {
  try {
    const { vehicle_id, registration_number } = req.query;

    let vehicle;
    if (vehicle_id) {
      vehicle = await Vehicle.findById(vehicle_id);
    } else if (registration_number) {
      vehicle = await Vehicle.findOne({ registration_number });
    } else {
      return res.status(400).json({ error: "Provide either vehicle_id or registration_number" });
    }

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    const vehicleState = await VehicleState.findOne({ vehicle_id: vehicle._id });

    res.json({
      vehicleId: vehicle._id,
      registration_number: vehicle.registration_number,
      make: vehicle.make,
      model: vehicle.model,
      manufacturing_year: vehicle.manufacturing_year,
      place_of_availability: vehicleState.place_of_availability,
      next_available_date: vehicleState ? vehicleState.next_available_date : null,
      status: vehicleState.status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE Vehicle
exports.updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, availability_place, next_available_date, ...updateData } = req.body;

    let vehicle_status; if (status) { vehicle_status = status.toUpperCase(); }
        
    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true, omitUndefined: true }
    );

    if (!updatedVehicle) {
      return res.status(404).json({ success: false, message: "Vehicle not found" });
    }

    if (next_available_date) {
      const inputDate = new Date(next_available_date);
      const today = new Date();

      if (inputDate <= today) {
        return res.status(400).json({
          success: false,
          message: `next_available_date must be greater than today's date/time`
        });
      }

      const vehicleState = await VehicleState.findOne({ vehicle_id: id });
      if (!vehicleState) {
        return res.status(404).json({ success: false, message: "Vehicle state not found" });
      }

      const updatedState = await VehicleState.findOneAndUpdate(
        { vehicle_id: id },
        {
          status: vehicle_status,
          place_of_availability: availability_place,
          next_available_date: inputDate
        },
        { new: true }
        );


      return res.status(200).json({
        success: true,
        message: "Vehicle updated successfully",
        data: {
          vehicle: updatedVehicle,
          place_of_availability: updatedState.place_of_availability,
          next_available_date: updatedState.next_available_date,
          status: updatedState.status
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      data: {
        vehicle: updatedVehicle,
        next_available_date: null
      }
    });
  } catch (err) {
    console.error("Update vehicle error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update vehicle",
      error: err.message
    });
  }
};

// DELETE Vehicle
// DELETE Vehicle
exports.deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    // Step 1: Check if vehicle exists in Vehicle collection
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: "Vehicle not found" });
    }

    // Step 2: Find VehicleState record
    const vehicleState = await VehicleState.findOne({ vehicle_id: id });
    if (!vehicleState) {
      return res.status(404).json({ success: false, message: "Vehicle state not found" });
    }

    const today = new Date();

    // Step 3: Allow delete only if next_available_date < today
    if (vehicleState.next_available_date < today) {
      await Vehicle.findByIdAndDelete(id);              // Delete from Vehicle collection
      await VehicleState.deleteOne({ vehicle_id: id }); // Delete from VehicleState collection

      return res.status(200).json({
        success: true,
        message: "Vehicle deleted successfully",
        next_available_date: vehicleState.next_available_date
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `Vehicle is on trip, next available date: ${vehicleState.next_available_date}`
      });
    }
  } catch (err) {
    console.error("Delete vehicle error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete vehicle",
      error: err.message
    });
  }
};

