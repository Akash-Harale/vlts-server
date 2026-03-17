// /controllers/vehicleController.js
// Vehicles API → Register vehicles, assign drivers, list vehicles.

const Vehicle = require("../models/vehicle");
const VehicleState = require("../models/vehicleState");
const DriverVehicleAssignment = require("../models/driverVehicleAssignment");

// CREATE Vehicle
exports.registerVehicle = async (req, res) => {
  try {
    const {
      tenant_id,
      client_id,
      make,
      model,
      registration_number,
      manufacturing_year,
      chassis_number,
      engine_number,
      date_of_subscription,
      regn_valid_upto,
      status,
      availability_place,
      next_available_place,
      next_available_date,
    } = req.body;

    console.log('vehicleController: registerVehicle: req.body: ', req.body);

    // Validate required new fields
    const final_tenant_id = tenant_id || (req.user && req.user.tenant_id);

    if (!final_tenant_id) {
      return res.status(400).json({ success: false, message: "tenant_id is required" });
    }
    const final_availability_place = next_available_place || availability_place;

    if (!client_id) {
      return res.status(400).json({ success: false, message: "client_id is required" });
    }
    if (!final_availability_place) {
      return res.status(400).json({ success: false, message: "availability_place or next_available_place is required" });
    }
    if (!chassis_number) {
      return res.status(400).json({ success: false, message: "chassis_number is required" });
    }
    if (!engine_number) {
      return res.status(400).json({ success: false, message: "engine_number is required" });
    }
    if (!date_of_subscription) {
      return res.status(400).json({ success: false, message: "date_of_subscription is required" });
    }
    if (!regn_valid_upto) {
      return res.status(400).json({ success: false, message: "regn_valid_upto is required" });
    }
    if (!next_available_date) {
      return res.status(400).json({ success: false, message: "next_available_date is required" });
    }

    const inputDate = new Date(next_available_date);
    const today = new Date();
    // Set today to start of day for easier comparison if needed, 
    // but here we just want to ensure it's not in the past.
    // Let's allow today's date by checking if it's at least more than an hour ago to account for slight delays
    const oneHourAgo = new Date(today.getTime() - (60 * 60 * 1000));

    if (inputDate < oneHourAgo) {
      return res.status(400).json({
        success: false,
        message: `next_available_date cannot be in the past`,
      });
    }

    const vehicle = new Vehicle({
      tenant_id: final_tenant_id,
      client_id,
      make,
      model,
      registration_number,
      manufacturing_year,
      chassis_number,
      engine_number,
      date_of_subscription: new Date(date_of_subscription),
      regn_valid_upto: new Date(regn_valid_upto),
      next_available_place: final_availability_place,
      next_available_date: inputDate,
    });
    await vehicle.save();

    const vehicleState = new VehicleState({
      vehicle_id: vehicle._id,
      place_of_availability: final_availability_place,
      next_available_date: inputDate,
      status: status ? status.toUpperCase() : "ACTIVE",
    });
    await vehicleState.save();

    res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      vehicle,
      availability_place,
      next_available_date,
      status,
    });
  } catch (err) {
    console.log('vehicleController: registerVehicle: error: ', err.message);
    res.status(500).json({ error: err.message });
  }
};


// Get all vehicles (include next_available_date)
exports.getVehicles = async (req, res) => {
  try {
    // const query = { tenant_id: req.user.tenant_id };

    // // Use client_id from query if provided (requested by user), 
    // // otherwise fallback to role-based filtering
    // const explicitClientId = req.query.client_id;
    
    // if (explicitClientId) {
    //   query.client_id = explicitClientId;
    // } else if (req.user.role === "tenant_user") {
    //   query.client_id = req.user.client_id;
    // }

    // Step 1: Fetch all matching vehicles first
    const vehicles = await Vehicle.find();
    if (!vehicles || vehicles.length === 0) {
      return res.json([]);
    }
    console.log('vehicleController: getVehicles: vehicles: ', vehicles);

    const vehicleIds = vehicles.map(v => v._id);

    // Step 2: Fetch states for these vehicles
    const states = await VehicleState.find({ vehicle_id: { $in: vehicleIds } });

    // Step 3: Map vehicles to their states (Robust: don't skip vehicles without state)
    const result = vehicles.map((v) => {
      const vs = states.find(s => s.vehicle_id.toString() === v._id.toString());
      
      return {
        vehicleId: v._id,
        client_id: v.client_id,
        registration_number: v.registration_number,
        make: v.make,
        model: v.model,
        manufacturing_year: v.manufacturing_year,
        chassis_number: v.chassis_number,
        engine_number: v.engine_number,
        date_of_subscription: v.date_of_subscription,
        regn_valid_upto: v.regn_valid_upto,
        // Fallback to vehicle base fields if state is missing
        next_available_place: vs?.place_of_availability || v.next_available_place || "N/A",
        next_available_date: vs?.next_available_date || v.next_available_date || null,
        status: vs?.status || "INACTIVE", // Default to INACTIVE if no state found
      };
    });

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
      client_id: vehicle.client_id,
      registration_number: vehicle.registration_number,
      make: vehicle.make,
      model: vehicle.model,
      manufacturing_year: vehicle.manufacturing_year,
      chassis_number: vehicle.chassis_number,
      engine_number: vehicle.engine_number,
      date_of_subscription: vehicle.date_of_subscription,
      regn_valid_upto: vehicle.regn_valid_upto,
      place_of_availability: vehicleState?.place_of_availability,
      next_available_date: vehicleState ? vehicleState.next_available_date : null,
      status: vehicleState?.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// UPDATE Vehicle
exports.updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      availability_place,
      next_available_date,
      date_of_subscription,
      regn_valid_upto,
      ...updateData
    } = req.body;

    let vehicle_status;
    if (status) { vehicle_status = status.toUpperCase(); }

    // Parse date fields if provided
    if (date_of_subscription) {
      updateData.date_of_subscription = new Date(date_of_subscription);
    }
    if (regn_valid_upto) {
      updateData.regn_valid_upto = new Date(regn_valid_upto);
    }

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
      const oneHourAgo = new Date(today.getTime() - (60 * 60 * 1000));

      if (inputDate < oneHourAgo) {
        return res.status(400).json({
          success: false,
          message: `next_available_date cannot be in the past`,
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
          next_available_date: inputDate,
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
          status: updatedState.status,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      data: {
        vehicle: updatedVehicle,
        next_available_date: null,
      },
    });
  } catch (err) {
    console.error("Update vehicle error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update vehicle",
      error: err.message,
    });
  }
};


// DELETE Vehicle
exports.deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    // Step 1: Check if vehicle exists
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
      await Vehicle.findByIdAndDelete(id);
      await VehicleState.deleteOne({ vehicle_id: id });

      return res.status(200).json({
        success: true,
        message: "Vehicle deleted successfully",
        next_available_date: vehicleState.next_available_date,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `Vehicle is on trip, next available date: ${vehicleState.next_available_date}`,
      });
    }
  } catch (err) {
    console.error("Delete vehicle error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete vehicle",
      error: err.message,
    });
  }
};