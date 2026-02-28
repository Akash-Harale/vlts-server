const express = require("express");
const router = express.Router();

const {
    createClient,
    getAllClients,
    getClientById,
    updateClient,
    deleteClient,
} = require("../controllers/clientController");

// CREATE
router.post("/", createClient);

// READ
router.get("/", getAllClients);
router.get("/:id", getClientById);

// UPDATE
router.put("/:id", updateClient);

// DELETE
router.delete("/:id", deleteClient);

module.exports = router;
