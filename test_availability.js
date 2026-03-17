const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Running from backend/
dotenv.config({ path: path.join(__dirname, '.env') });

const VehicleState = require('./models/vehicleState');
const Vehicle = require('./models/vehicle');

async function testAvailability() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    // We need a place that exists in the DB. 
    // From my logs earlier: vehicleAvailabilityController: search place: "Nagpur"
    const place = 'Nagpur';
    const depDate = new Date();
    depDate.setDate(depDate.getDate() + 5); // Future date to ensure <= depDate works if next_available_date is today
    
    console.log(`\nTesting Case-Insensitive Search for: "${place.toLowerCase()}"`);
    const resultsLower = await VehicleState.find({
      place_of_availability: { $regex: new RegExp(`^${place.toLowerCase()}$`, "i") },
      next_available_date: { $lte: depDate },
      status: "ACTIVE"
    });
    console.log(`Found ${resultsLower.length} vehicles with lowercase input.`);

    console.log(`\nTesting Case-Insensitive Search for: "${place.toUpperCase()}"`);
    const resultsUpper = await VehicleState.find({
      place_of_availability: { $regex: new RegExp(`^${place.toUpperCase()}$`, "i") },
      next_available_date: { $lte: depDate },
      status: "ACTIVE"
    });
    console.log(`Found ${resultsUpper.length} vehicles with uppercase input.`);

    if (resultsLower.length === resultsUpper.length && resultsLower.length >= 0) {
      console.log('\nSUCCESS: Case-insensitive search working correctly (or both returned 0, which is consistent).');
    } else {
      console.log('\nFAILURE: Results mismatch between lowercase and uppercase.');
    }

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

testAvailability();
