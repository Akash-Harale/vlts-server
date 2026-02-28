# Mock Data Flow
Create Route + Geofence
Source: Delhi [77.2090, 28.6139]
Destination: Agra [78.0081, 27.1767]
Geofence radius: 500m

Register Vehicle
Registration: UP32AB1234
Model: Tata Ace
Driver: Ramesh Kumar

Add Vehicle Position
Coordinates: [77.4126, 28.6692] (Ghaziabad)
Speed: 45 km/h
Heading: 90°

Check Deviation
Pass positionId, routeId, geofenceId from earlier API responses.
If vehicle is outside geofence or off route, deviation alert is logged + email sent.

# Mock Data Flow for Vehicle Assignment
Create Route
Delhi to Agra route with geofence.
Save returned routeId.

Register Vehicle
Vehicle: UP32AB1234, Model: Tata Ace, Driver: Ramesh Kumar.
Save returned vehicleId.

Assign Vehicle to Route
POST /api/assignments with routeId + vehicleId.

Get Vehicles by Route
GET /api/assignments/route/{{routeId}} → shows all vehicles mapped to that route.

Get Route by Vehicle
GET /api/assignments/vehicle/{{vehicleId}} → shows which route the vehicle is running on.

# TRIP REPLAY DESIGN (On Demand)
# OPTION 1: REST API

Admin requests trip history for a vehicle/route.
Backend queries vehicle_routes_history and returns ordered GPS points.
Admin client decides how to render (e.g., animate markers on a map).

# OPTION 2: WebSocket Replay (Optional)

Admin sends a replay request via WebSocket with vehicle/route identifiers.
Server fetches history and emits points one by one (with configurable delay) to simulate the trip.
This is triggered only when Admin asks — not automatically.

# Usage Examples
# 1. Vehicle sends live GPS update
json
{
  "type": "update",
  "registration_number": "UP32AB1234",
  "route_name": "Delhi to Agra",
  "coordinates": [77.4126, 28.6692]
}
# 2. Admin requests trip replay
json
{
  "type": "replay",
  "registration_number": "UP32AB1234",
  "route_name": "Delhi to Agra"
}

# Trip History and Trip Replay : Summary
Trip Listings API → GET /api/trips returns available trips with start/end times.

Trip Replay API → GET /api/replay supports queries by vehicle_id + route_id or registration_number + route_name.

#  Postman collection: Trip Listings API (/api/trips) and the Trip Replay API (/api/replay), plus WebSocket replay test requests to trigger live playback directly from Postman’s WebSocket support.

# Postman Collection JSON (Trips + Replay + WebSocket)

{
  "info": {
    "name": "Fleet Management PoC - Trips & Replay",
    "_postman_id": "fleet-mgmt-poc-trips-replay",
    "description": "Postman collection to test Trip Listings, Trip Replay APIs, and WebSocket replay",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "List Available Trips",
      "request": {
        "method": "GET",
        "url": {
          "raw": "http://localhost:3005/api/trips",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3005",
          "path": ["api", "trips"]
        }
      }
    },
    {
      "name": "Replay Trip by Vehicle ID + Route ID",
      "request": {
        "method": "GET",
        "url": {
          "raw": "http://localhost:3005/api/replay?vehicle_id={{vehicleId}}&route_id={{routeId}}",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3005",
          "path": ["api", "replay"],
          "query": [
            { "key": "vehicle_id", "value": "{{vehicleId}}" },
            { "key": "route_id", "value": "{{routeId}}" }
          ]
        }
      }
    },
    {
      "name": "Replay Trip by Registration Number + Route Name",
      "request": {
        "method": "GET",
        "url": {
          "raw": "http://localhost:3005/api/replay?registration_number={{registrationNumber}}&route_name={{routeName}}",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3005",
          "path": ["api", "replay"],
          "query": [
            { "key": "registration_number", "value": "{{registrationNumber}}" },
            { "key": "route_name", "value": "{{routeName}}" }
          ]
        }
      }
    },
    {
      "name": "WebSocket - Live Vehicle Update",
      "request": {
        "method": "GET",
        "url": {
          "raw": "ws://localhost:3005",
          "protocol": "ws",
          "host": ["localhost"],
          "port": "3005"
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"type\": \"update\",\n  \"registration_number\": \"UP32AB1234\",\n  \"route_name\": \"Delhi to Agra\",\n  \"coordinates\": [77.4126, 28.6692]\n}"
        }
      }
    },
    {
      "name": "WebSocket - Replay Trip On Demand",
      "request": {
        "method": "GET",
        "url": {
          "raw": "ws://localhost:3005",
          "protocol": "ws",
          "host": ["localhost"],
          "port": "3005"
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"type\": \"replay\",\n  \"registration_number\": \"UP32AB1234\",\n  \"route_name\": \"Delhi to Agra\"\n}"
        }
      }
    }
  ]
}

# How to Use in Postman
Import → Paste this JSON into Postman.
Trip Listings → Run GET /api/trips to see available trips.
Trip Replay (REST) → Run GET /api/replay with either vehicle_id + route_id or registration_number + route_name.
WebSocket Live Update → Connect to ws://localhost:3005 and send the JSON payload with type: update.
WebSocket Replay → Connect to ws://localhost:3005 and send the JSON payload with type: replay.

# Postman Collection JSON (Trips + Replay + WebSocket with Responses)

{
  "info": {
    "name": "Fleet Management PoC - Trips & Replay",
    "_postman_id": "fleet-mgmt-poc-trips-replay",
    "description": "Postman collection to test Trip Listings, Trip Replay APIs, and WebSocket replay/live updates with sample responses",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "List Available Trips",
      "request": {
        "method": "GET",
        "url": {
          "raw": "http://localhost:3005/api/trips",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3005",
          "path": ["api", "trips"]
        }
      },
      "response": [
        {
          "name": "Sample Trip Listing Response",
          "status": "OK",
          "code": 200,
          "body": "[\n  {\n    \"_id\": {\n      \"vehicle_id\": \"67a0f2c9e4b1a2d9f8c12345\",\n      \"route_id\": \"67a0f3dce4b1a2d9f8c67890\"\n    },\n    \"registration_number\": \"UP32AB1234\",\n    \"route_name\": \"Delhi to Agra\",\n    \"start_time\": \"2026-01-22T12:30:00.000Z\",\n    \"end_time\": \"2026-01-22T14:15:00.000Z\"\n  }\n]"
        }
      ]
    },
    {
      "name": "Replay Trip by Vehicle ID + Route ID",
      "request": {
        "method": "GET",
        "url": {
          "raw": "http://localhost:3005/api/replay?vehicle_id={{vehicleId}}&route_id={{routeId}}",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3005",
          "path": ["api", "replay"],
          "query": [
            { "key": "vehicle_id", "value": "{{vehicleId}}" },
            { "key": "route_id", "value": "{{routeId}}" }
          ]
        }
      },
      "response": [
        {
          "name": "Sample Replay Response (by IDs)",
          "status": "OK",
          "code": 200,
          "body": "[\n  {\n    \"registration_number\": \"UP32AB1234\",\n    \"route_name\": \"Delhi to Agra\",\n    \"location\": { \"type\": \"Point\", \"coordinates\": [77.2090, 28.6139] },\n    \"geofence_status\": \"WITHIN\",\n    \"timestamp\": \"2026-01-22T12:30:00.000Z\"\n  },\n  {\n    \"registration_number\": \"UP32AB1234\",\n    \"route_name\": \"Delhi to Agra\",\n    \"location\": { \"type\": \"Point\", \"coordinates\": [77.4126, 28.6692] },\n    \"geofence_status\": \"OUTSIDE\",\n    \"timestamp\": \"2026-01-22T12:45:00.000Z\"\n  }\n]"
        }
      ]
    },
    {
      "name": "Replay Trip by Registration Number + Route Name",
      "request": {
        "method": "GET",
        "url": {
          "raw": "http://localhost:3005/api/replay?registration_number={{registrationNumber}}&route_name={{routeName}}",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3005",
          "path": ["api", "replay"],
          "query": [
            { "key": "registration_number", "value": "{{registrationNumber}}" },
            { "key": "route_name", "value": "{{routeName}}" }
          ]
        }
      },
      "response": [
        {
          "name": "Sample Replay Response (by Reg No + Name)",
          "status": "OK",
          "code": 200,
          "body": "[\n  {\n    \"registration_number\": \"UP32AB1234\",\n    \"route_name\": \"Delhi to Agra\",\n    \"location\": { \"type\": \"Point\", \"coordinates\": [77.2090, 28.6139] },\n    \"geofence_status\": \"WITHIN\",\n    \"timestamp\": \"2026-01-22T12:30:00.000Z\"\n  }\n]"
        }
      ]
    },
    {
      "name": "WebSocket - Live Vehicle Update",
      "request": {
        "method": "GET",
        "url": {
          "raw": "ws://localhost:3005",
          "protocol": "ws",
          "host": ["localhost"],
          "port": "3005"
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"type\": \"update\",\n  \"registration_number\": \"UP32AB1234\",\n  \"route_name\": \"Delhi to Agra\",\n  \"coordinates\": [77.4126, 28.6692]\n}"
        }
      },
      "response": [
        {
          "name": "Sample WebSocket Live Response",
          "status": "Message",
          "body": "{\n  \"type\": \"live\",\n  \"registration_number\": \"UP32AB1234\",\n  \"route_name\": \"Delhi to Agra\",\n  \"coordinates\": [77.4126, 28.6692],\n  \"geofence_status\": \"WITHIN\",\n  \"timestamp\": \"2026-01-22T12:35:00.000Z\"\n}"
        }
      ]
    },
    {
      "name": "WebSocket - Replay Trip On Demand",
      "request": {
        "method": "GET",
        "url": {
          "raw": "ws://localhost:3005",
          "protocol": "ws",
          "host": ["localhost"],
          "port": "3005"
        },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"type\": \"replay\",\n  \"registration_number\": \"UP32AB1234\",\n  \"route_name\": \"Delhi to Agra\"\n}"
        }
      },
      "response": [
        {
          "name": "Sample WebSocket Replay Response",
          "status": "Message",
          "body": "{\n  \"type\": \"replay\",\n  \"registration_number\": \"UP32AB1234\",\n  \"route_name\": \"Delhi to Agra\",\n  \"coordinates\": [77.2090, 28.6139],\n  \"geofence_status\": \"WITHIN\",\n  \"timestamp\": \"2026-01-22T12:30:00.000Z\"\n}"
        }
      ]
    }
  ]
}

# Summary
Trip Listings API → GET /api/trips
Trip Replay API → GET /api/replay (by IDs or by registration number + route name)
WebSocket Live Update → type: update payload, sample response included
WebSocket Replay On Demand → type: replay payload, sample response included

#  Tips While Testing the WebSocket Server and Client
Run two clients: one simulating a vehicle (type: update) and one simulating an admin (type: replay) to see broadcast behavior.
Check MongoDB vehicleTripsHistory collection after sending updates — each GPS point should be stored with geofence status.
Verify timestamps are increasing and sorted correctly during replay.


# VLTS Trip History API

## Overview
The VLTS Trip History API provides endpoints to query and replay vehicle trip data.  
It is organized into three modules:

1. **Trip History (Summary)** → High-level trip metadata, routes, vehicle, and driver info.  
2. **Trip History Events** → Detailed event logs for trips.  
3. **Trip History Events Replay** → Chunked JSON streaming of events for playback.

---

## Base URL
http://localhost:5000/history


---

## 1. Trip History (Summary)

### Get trip summary by trip ID

GET /history/trip/:tripId

Returns trip metadata, route, vehicle, and driver info.

### Get trips by vehicle ID
GET /history/vehicle/:vehicleId

Returns all trips linked to a vehicle, enriched with driver info.

### Get trips by driver ID
GET /history/driver/:driverId

Returns all trips linked to a driver, enriched with vehicle info.

### Get all trips
GET /history/all

Returns all trips with vehicle and driver enrichment.

### Get trips by date range
GET /history/date-range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
Returns trips within a date range, enriched with vehicle and driver info.

---

## 2. Trip History Events

### Get trip events by trip ID
GET /history/trip/:tripId/events

Returns all events for a specific trip.

### Get trip events by vehicle ID
GET /history/vehicle/:vehicleId/events

Returns events for all trips linked to a vehicle.

### Get trip events by driver ID
GET /history/driver/:driverId/events

Returns events for all trips linked to a driver.

### Get all trip events
GET /history/all/events

Returns all trip event documents.

### Get trip events by date range
GET /history/events/date-range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD

Returns events for trips within a date range.

---

## 3. Trip History Events Replay

### Replay trip events by trip ID
GET /history/trip/:tripId/replay

Streams trip events in chronological order with a 1-second delay between events.  
Response is chunked JSON, simulating real-time playback.

---

## Example Event Object
```json
{
  "timestamp": "2026-02-25T08:30:00Z",
  "location": { "type": "Point", "coordinates": [77.412, 28.669] },
  "speed": 45,
  "event_type": "START",
  "notes": "Trip started from depot"
}


# API Endpoints naming conventions
# use nouns not verbs
GET    /users          # list
POST   /users          # create
GET    /users/123      # retrieve
PUT    /users/123      # replace
PATCH  /users/123      # partial update
DELETE /users/123      # remove
