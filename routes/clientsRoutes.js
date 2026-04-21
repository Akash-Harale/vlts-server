// Purpose: Tenant-scoped client provisioning CRUD APIs
// Client provision ing means add/update/view/delete clients for the given tenant

// 21 March 2026
// routes/tenantClientRoutes.js

const express = require('express');
const router = express.Router();
const {
  createClient,
  getClients,
  updateClient,
  deleteClient,getClientById
} = require('../controllers/ClientController');

const authMiddleware = require('../middleware/authMiddleware');

// Client provisioning (Tenant Admin / Tenant Manager only)
router.post('/', authMiddleware(["manage_clients"]), createClient);
router.get('/', authMiddleware(["manage_clients"]), getClients  );
router.get('/:id', authMiddleware(["manage_clients"]), getClientById);
router.put('/:id', authMiddleware(["manage_clients"]), updateClient);
router.delete('/:id', authMiddleware(["manage_clients"]), deleteClient);

module.exports = router;












// const express = require("express");
// const router = express.Router();

// const {
//     createClient,
//     getAllClients,
//     getClientById,
//     updateClient,
//     deleteClient,
// } = require("../controllers/clientController");

// // CREATE
// router.post("/", createClient);

// // READ
// router.get("/", getAllClients);
// router.get("/:id", getClientById);

// // UPDATE
// router.put("/:id", updateClient);

// // DELETE
// router.delete("/:id", deleteClient);

// module.exports = router;
