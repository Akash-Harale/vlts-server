# API Endpoint Test Results

This document contains automated test results for all 106 endpoints retrieved from the Postman collection.

## Summary

- **Total Endpoints Tested**: 106
- **Working Endpoints (Active / Operational)**: 72
- **Endpoints Returning Errors or Not Found (404/500/Connection Issues)**: 34

## Detailed Endpoints Table

| # | Endpoint Name | Folder Path | Method | URL tested | Status | Status Rating | Details |
|---|---|---|---|---|---|---|---|
| 1 | POST /api/routes | Route Routes.js | **POST** | `/api/routes` | 500 | 🔴 Broker / Failed (5xx or Connection Error) | `{"error":"Cannot read properties of undefined (reading '0')"}` |
| 2 | GET /api/routes | Route Routes.js | **GET** | `/api/routes` | 200 | 🟢 Working | - |
| 3 | DELETE /api/routes/:id | Route Routes.js | **DELETE** | `/api/routes/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"success":false,"message":"Route not found"}` |
| 4 | GET /api/routes/summary | Route Routes.js | **GET** | `/api/routes/summary` | 200 | 🟢 Working | - |
| 5 | GET /api/routes/id/:id | Route Routes.js | **GET** | `/api/routes/id/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"Route not found"}` |
| 6 | GET /api/routes/name/:name | Route Routes.js | **GET** | `/api/routes/name/ tata` | 404 | 🔴 Not Found (404) | `{"error":"Route not found"}` |
| 7 | GET /api/routes/geocodes | Route Routes.js | **GET** | `/api/routes/geocodes` | 400 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Source and destination addresses are required"}` |
| 8 | GET /api/routes/sldistance | Route Routes.js | **GET** | `/api/routes/sldistance` | 400 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Source and destination addresses are required"}` |
| 9 | GET /api/routes/multi-routes | Route Routes.js | **GET** | `/api/routes/multi-routes` | 400 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Source and destination addresses are required"}` |
| 10 | GET /api/routes/multi-routes-with-stops | Route Routes.js | **GET** | `/api/routes/multi-routes-with-stops` | 400 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Source and destination addresses are required"}` |
| 11 | POST /api/vehicle/ | Vehicle Routes.js | **POST** | `/api/vehicle/` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 12 | GET /api/vehicle/ | Vehicle Routes.js | **GET** | `/api/vehicle/` | 200 | 🟢 Working | - |
| 13 | GET /api/vehicle/:id | Vehicle Routes.js | **GET** | `/api/vehicle/6a5d84046dd45c8e367421c9` | 400 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Provide either vehicle_id or registration_number"}` |
| 14 | PUT /api/vehicle/:id | Vehicle Routes.js | **PUT** | `/api/vehicle/6a5d84046dd45c8e367421c9` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 15 | DELETE /api/vehicle/:id | Vehicle Routes.js | **DELETE** | `/api/vehicle/6a5d84046dd45c8e367421c9` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 16 | POST /api/positions | Position Routes.js | **POST** | `/api/positions` | 500 | 🔴 Broker / Failed (5xx or Connection Error) | `{"error":"VehiclePosition validation failed: location.coordinates: Path `location.coordinates` is re` |
| 17 | GET /api/positions | Position Routes.js | **GET** | `/api/positions` | 200 | 🟢 Working | - |
| 18 | POST /api/deviations/check | Deviation Routes.js | **POST** | `/api/deviations/check` | 200 | 🟢 Working | - |
| 19 | POST /api/deviations/checkvehicle | Deviation Routes.js | **POST** | `/api/deviations/checkvehicle` | 404 | 🔴 Not Found (404) | `{"error":"Vehicle not found"}` |
| 20 | GET /api/replay | Trip Replay Routes.js | **GET** | `/api/replay` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 21 | POST /api/gps-allocation/technician | Gps Allocation | **POST** | `/api/gps-allocation/technician` | 200 | 🟢 Working | - |
| 22 | POST /api/gps-allocation/salesperson | Gps Allocation | **POST** | `/api/gps-allocation/salesperson` | 200 | 🟢 Working | - |
| 23 | GET /api/user/roles | User | **GET** | `/api/user/roles` | 200 | 🟢 Working | - |
| 24 | POST /api/user/ | User | **POST** | `/api/user/` | 500 | 🔴 Broker / Failed (5xx or Connection Error) | `{"message":"E11000 duplicate key error collection: vlts_poc.employees index: email_1 dup key: { emai` |
| 25 | GET /api/user/ | User | **GET** | `/api/user/` | 200 | 🟢 Working | - |
| 26 | GET /api/user/:id | User | **GET** | `/api/user/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"message":"Tenant user not found"}` |
| 27 | PUT /api/user/:id | User | **PUT** | `/api/user/6a5d84046dd45c8e367421c9` | 500 | 🔴 Broker / Failed (5xx or Connection Error) | `{"message":"Cannot read properties of null (reading 'role')"}` |
| 28 | DELETE /api/user/:id | User | **DELETE** | `/api/user/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"User not found"}` |
| 29 | POST /api/driverassignments | Driver Vehicle Routes.js | **POST** | `/api/driverassignments` | 201 | 🟢 Working | - |
| 30 | GET /api/driverassignments | Driver Vehicle Routes.js | **GET** | `/api/driverassignments` | 200 | 🟢 Working | - |
| 31 | GET /api/driverassignments/:id | Driver Vehicle Routes.js | **GET** | `/api/driverassignments/6a5d84046dd45c8e367421c9` | 200 | 🟢 Working | - |
| 32 | PUT /api/driverassignments/:id | Driver Vehicle Routes.js | **PUT** | `/api/driverassignments/6a5d84046dd45c8e367421c9` | 200 | 🟢 Working | - |
| 33 | DELETE /api/driverassignments/:id | Driver Vehicle Routes.js | **DELETE** | `/api/driverassignments/6a5d84046dd45c8e367421c9` | 200 | 🟢 Working | - |
| 34 | GET /api/alert/:vehicle_id | Alert Routes.js | **GET** | `/api/alert/6a5d84016dd45c8e36742198` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 35 | POST /api/alert/:vehicle_id | Alert Routes.js | **POST** | `/api/alert/6a5d84016dd45c8e36742198` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 36 | PUT /api/alert/:id | Alert Routes.js | **PUT** | `/api/alert/6a5d84046dd45c8e367421c9` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 37 | PUT /api/alert/update-all/:vehicle_id | Alert Routes.js | **PUT** | `/api/alert/update-all/6a5d84016dd45c8e36742198` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 38 | DELETE /api/alert/:id | Alert Routes.js | **DELETE** | `/api/alert/6a5d84046dd45c8e367421c9` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 39 | DELETE /api/alert/ | Alert Routes.js | **DELETE** | `/api/alert/` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 40 | GET /api/alert/history/:vehicle_id | Alert Routes.js | **GET** | `/api/alert/history/6a5d84016dd45c8e36742198` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 41 | GET /api/school-driver/vehicle | School Driver Routes.js | **GET** | `/api/school-driver/vehicle` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 42 | GET /api/school-driver/temp-route | School Driver Routes.js | **GET** | `/api/school-driver/temp-route` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 43 | POST /api/school-driver/temp-route | School Driver Routes.js | **POST** | `/api/school-driver/temp-route` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 44 | PUT /api/school-driver/temp-route/:route_id | School Driver Routes.js | **PUT** | `/api/school-driver/temp-route/65f242512f6a7353f2081f9a` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 45 | DELETE /api/school-driver/temp-route/:route_id | School Driver Routes.js | **DELETE** | `/api/school-driver/temp-route/65f242512f6a7353f2081f9a` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 46 | POST /api/driver/ | Driver Routes.js | **POST** | `/api/driver/` | 500 | 🔴 Broker / Failed (5xx or Connection Error) | `{"error":"E11000 duplicate key error collection: vlts_poc.employees index: email_1 dup key: { email:` |
| 47 | GET /api/driver/ | Driver Routes.js | **GET** | `/api/driver/` | 200 | 🟢 Working | - |
| 48 | GET /api/driver/:id | Driver Routes.js | **GET** | `/api/driver/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"Driver not found"}` |
| 49 | PUT /api/driver/:id | Driver Routes.js | **PUT** | `/api/driver/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"Driver not found"}` |
| 50 | DELETE /api/driver/:id | Driver Routes.js | **DELETE** | `/api/driver/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"Driver not found"}` |
| 51 | POST /api/driver/login | Driver Routes.js | **POST** | `/api/driver/login` | 200 | 🟢 Working | - |
| 52 | POST /api/client-auth/login | Client Auth Routes.js | **POST** | `/api/client-auth/login` | 200 | 🟢 Working | - |
| 53 | POST /api/client-auth/logout | Client Auth Routes.js | **POST** | `/api/client-auth/logout` | 200 | 🟢 Working | - |
| 54 | POST /api/client-auth/refresh | Client Auth Routes.js | **POST** | `/api/client-auth/refresh` | 401 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Refresh token required"}` |
| 55 | GET /api/client-auth/profile | Client Auth Routes.js | **GET** | `/api/client-auth/profile` | 200 | 🟢 Working | - |
| 56 | GET /api/client-auth/me | Client Auth Routes.js | **GET** | `/api/client-auth/me` | 404 | 🔴 Not Found (404) | `{"error":"Client profile not found"}` |
| 57 | GET /api/driverswithuserid | Driver User Routes.js | **GET** | `/api/driverswithuserid` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 58 | POST /api/gps/ | Gps Device Routes.js | **POST** | `/api/gps/` | 400 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"E11000 duplicate key error collection: vlts_poc.gpsdevices index: imei_1 dup key: { imei: ` |
| 59 | GET /api/gps/ | Gps Device Routes.js | **GET** | `/api/gps/` | 200 | 🟢 Working | - |
| 60 | GET /api/gps/:id | Gps Device Routes.js | **GET** | `/api/gps/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"Device not found"}` |
| 61 | PUT /api/gps/:id | Gps Device Routes.js | **PUT** | `/api/gps/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"Device not found"}` |
| 62 | DELETE /api/gps/:id | Gps Device Routes.js | **DELETE** | `/api/gps/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"Device not found"}` |
| 63 | POST /api/gps/:id/heartbeat | Gps Device Routes.js | **POST** | `/api/gps/6a5d84046dd45c8e367421c9/heartbeat` | 404 | 🔴 Not Found (404) | `{"error":"Device not found"}` |
| 64 | POST /api/assignments/gps-vehicle | Vehicle Device Map Routes.js | **POST** | `/api/assignments/gps-vehicle` | 409 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Device already mapped"}` |
| 65 | GET /api/assignments/gps-vehicle/:id | Vehicle Device Map Routes.js | **GET** | `/api/assignments/gps-vehicle/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `[]` |
| 66 | POST /api/clients/ | Clients Routes.js | **POST** | `/api/clients/` | 500 | 🔴 Broker / Failed (5xx or Connection Error) | `{"message":"Employee validation failed: email: Path `email` is required."}` |
| 67 | GET /api/clients/ | Clients Routes.js | **GET** | `/api/clients/` | 200 | 🟢 Working | - |
| 68 | GET /api/clients/:id | Clients Routes.js | **GET** | `/api/clients/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"message":"Client not found"}` |
| 69 | PUT /api/clients/:id | Clients Routes.js | **PUT** | `/api/clients/6a5d84046dd45c8e367421c9` | 400 | 🟡 Parameter Issue / Client Error (4xx) | `{"message":"entity_name cannot be updated"}` |
| 70 | DELETE /api/clients/:id | Clients Routes.js | **DELETE** | `/api/clients/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"Client not found"}` |
| 71 | POST /api/auth/superadmin/login | Super Admin Routes.js | **POST** | `/api/auth/superadmin/login` | 200 | 🟢 Working | - |
| 72 | POST /api/auth/superadmin/logout | Super Admin Routes.js | **POST** | `/api/auth/superadmin/logout` | 200 | 🟢 Working | - |
| 73 | POST /api/auth/superadmin/refresh | Super Admin Routes.js | **POST** | `/api/auth/superadmin/refresh` | 401 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Refresh token required"}` |
| 74 | POST /api/auth/tenantadmin/login | Tenant Admin Routes.js | **POST** | `/api/auth/tenantadmin/login` | 200 | 🟢 Working | - |
| 75 | POST /api/auth/tenantadmin/logout | Tenant Admin Routes.js | **POST** | `/api/auth/tenantadmin/logout` | 200 | 🟢 Working | - |
| 76 | POST /api/auth/tenantadmin/refresh | Tenant Admin Routes.js | **POST** | `/api/auth/tenantadmin/refresh` | 401 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Refresh token required"}` |
| 77 | POST /api/auth/tenantadmin/users | Tenant Admin Routes.js | **POST** | `/api/auth/tenantadmin/users` | 500 | 🔴 Broker / Failed (5xx or Connection Error) | `{"message":"E11000 duplicate key error collection: vlts_poc.employees index: email_1 dup key: { emai` |
| 78 | GET /api/auth/tenantadmin/users | Tenant Admin Routes.js | **GET** | `/api/auth/tenantadmin/users` | 200 | 🟢 Working | - |
| 79 | GET /api/auth/tenantadmin/users/:id | Tenant Admin Routes.js | **GET** | `/api/auth/tenantadmin/users/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"message":"Tenant user not found"}` |
| 80 | PUT /api/auth/tenantadmin/users/:id | Tenant Admin Routes.js | **PUT** | `/api/auth/tenantadmin/users/6a5d84046dd45c8e367421c9` | 500 | 🔴 Broker / Failed (5xx or Connection Error) | `{"message":"Cannot read properties of null (reading 'role')"}` |
| 81 | DELETE /api/auth/tenantadmin/users/:id | Tenant Admin Routes.js | **DELETE** | `/api/auth/tenantadmin/users/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"User not found"}` |
| 82 | POST /api/auth/tenantuser/login | Tenant User Auth Routes.js | **POST** | `/api/auth/tenantuser/login` | 200 | 🟢 Working | - |
| 83 | POST /api/auth/tenantuser/logout | Tenant User Auth Routes.js | **POST** | `/api/auth/tenantuser/logout` | 200 | 🟢 Working | - |
| 84 | POST /api/auth/tenantuser/refresh | Tenant User Auth Routes.js | **POST** | `/api/auth/tenantuser/refresh` | 401 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Refresh token required"}` |
| 85 | POST /api/archiveExpiredAssignments | Archive Routes.js | **POST** | `/api/archiveExpiredAssignments` | 200 | 🟢 Working | - |
| 86 | GET /api/archivedAssignments | Archive Routes.js | **GET** | `/api/archivedAssignments` | 200 | 🟢 Working | - |
| 87 | POST /api/helpdesk/ | Help Desk Routes.js | **POST** | `/api/helpdesk/` | 400 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Type, subject, and description are required"}` |
| 88 | GET /api/helpdesk/mine | Help Desk Routes.js | **GET** | `/api/helpdesk/mine` | 200 | 🟢 Working | - |
| 89 | GET /api/checkavailability/vehiclebylocation | Check Availability Routes.js | **GET** | `/api/checkavailability/vehiclebylocation` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 90 | GET /api/checkavailability/drivers | Check Availability Routes.js | **GET** | `/api/checkavailability/drivers` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 91 | GET /api/checkavailability/vehicles | Check Availability Routes.js | **GET** | `/api/checkavailability/vehicles` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 92 | GET /api/trip-history | Trip History Routes.js | **GET** | `/api/trip-history` | 404 | 🔴 Not Found (404) | `"<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head` |
| 93 | GET /api/trip-history/:tripId | Trip History Routes.js | **GET** | `/api/trip-history/65f242512f6a7353f2081f9b` | 404 | 🔴 Not Found (404) | `"<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head` |
| 94 | GET /api/all/events | Trip History Events Routes.js | **GET** | `/api/all/events` | 403 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"Insufficient privileges"}` |
| 95 | GET /api/gpsalerts/ | Gps Alert Routes.js | **GET** | `/api/gpsalerts/` | 200 | 🟢 Working | - |
| 96 | GET /api/gpsalerts/:id | Gps Alert Routes.js | **GET** | `/api/gpsalerts/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"Alert not found"}` |
| 97 | PATCH /api/gpsalerts/:id/acknowledge | Gps Alert Routes.js | **PATCH** | `/api/gpsalerts/6a5d84046dd45c8e367421c9/acknowledge` | 404 | 🔴 Not Found (404) | `{"error":"Alert not found"}` |
| 98 | DELETE /api/gpsalerts/:id | Gps Alert Routes.js | **DELETE** | `/api/gpsalerts/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"Alert not found"}` |
| 99 | GET /api/telemetry/ | Telemetry Routes.js | **GET** | `/api/telemetry/` | 200 | 🟢 Working | - |
| 100 | GET /api/telemetry/:id | Telemetry Routes.js | **GET** | `/api/telemetry/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"Telemetry not found"}` |
| 101 | DELETE /api/telemetry/:id | Telemetry Routes.js | **DELETE** | `/api/telemetry/6a5d84046dd45c8e367421c9` | 404 | 🔴 Not Found (404) | `{"error":"Telemetry not found"}` |
| 102 | GET /api/telemetry/stats/distance | Telemetry Stats Routes.js | **GET** | `/api/telemetry/stats/distance` | 400 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"vehicleId and date are required"}` |
| 103 | GET /api/telemetry/stats/average-speed | Telemetry Stats Routes.js | **GET** | `/api/telemetry/stats/average-speed` | 400 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"vehicleId is required"}` |
| 104 | GET /api/telemetry/stats/idle-time | Telemetry Stats Routes.js | **GET** | `/api/telemetry/stats/idle-time` | 400 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"vehicleId is required"}` |
| 105 | GET /api/telemetry/stats/overspeed-count | Telemetry Stats Routes.js | **GET** | `/api/telemetry/stats/overspeed-count` | 200 | 🟢 Working | - |
| 106 | GET /api/telemetry/dashboard/ | Telemetry Dashboard Routes.js | **GET** | `/api/telemetry/dashboard/` | 400 | 🟡 Parameter Issue / Client Error (4xx) | `{"error":"vehicleId and date are required"}` |
