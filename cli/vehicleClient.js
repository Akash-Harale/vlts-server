// /cli/vehicleClient.js
const WebSocket = require("ws");

// Connect to WebSocket server
const ws = new WebSocket("ws://localhost:3005/ws"); // adjust path if needed

ws.on("open", () => {
  console.log(" Vehicle connected to WebSocket server");

  const route_id = "69736b313f1ad3329dd4c820";
  const vehicle_id = "69784c421713b3caf557379b";
  const driver_id = "697b3360dc566db4c1be574f";

  // Send live GPS update every 5 seconds
  setInterval(() => {
    const payload = {
      type: "update",
      route_id: route_id,
      vehicle_id: vehicle_id,
      driver_id: driver_id,
      registration_number: "UP32AB1234",
      route_name: "Delhi to Agra",
      coordinates: [
        77.209 + Math.random() * 0.01, // simulate movement
        28.6139 + Math.random() * 0.01,
      ],
    };
    console.log(" Vehicle sending payload:", payload);
    ws.send(JSON.stringify(payload));
  }, 1000);
});

ws.on("message", (msg) => {
  try {
    const data = JSON.parse(msg.toString());
    console.log(" Vehicle received payload:", data);
  } catch (err) {
    console.error(" Error parsing received message:", err.message);
  }
});

ws.on("error", (err) => {
  console.error(" Vehicle WebSocket error:", err.message);
});
