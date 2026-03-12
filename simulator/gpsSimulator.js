// simulator/gpsSimulator.js
// Multi GPS Device simulator

const net = require('net');

// Configuration
const HOST = 'localhost';
const PORT = 5000;

// Simulated devices
const devices = [
    { imei: '356938035643809', lat: 28.6139, lon: 77.2090 },
    { imei: '356938035643810', lat: 27.1767, lon: 78.0081 },
    { imei: '356938035643811', lat: 26.9124, lon: 75.7873 }
];

// Function to generate random telemetry
function generateTelemetry(device) {
    return {
        imei: device.imei,
        lat: device.lat + (Math.random() - 0.5) * 1.11,   // jitter latitude
        lon: device.lon + (Math.random() - 0.5) * 1.01,   // jitter longitude
        speed: Math.floor(Math.random() * 80),            // random speed 0–80
        direction: Math.floor(Math.random() * 360)        // random direction
    };
}

// Function to simulate one device
function simulateDevice(device) {
    const client = new net.Socket();
    client.connect(PORT, HOST, () => {
        console.log(`Device ${device.imei} connected to TCP server`);
        setInterval(() => {
            const telemetry = generateTelemetry(device);
            client.write(JSON.stringify(telemetry));
            console.log(`Device ${device.imei} sent:`, telemetry);
        }, 5000); // send every 5 seconds
    });

    client.on('error', err => {
        console.error(`Device ${device.imei} error:`, err.message);
    });
}

// Start simulation for all devices
devices.forEach(simulateDevice);

