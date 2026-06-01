const { TempRoute } = require("../models/temp_route.model");

const createTempRoute = async (req, res) => {
    try {
        const client_id = req.user.client_profile_id;
        const { driver_id } = req.body;
        const { vehicle_id } = req.body;
        const { route_name } = req.body;

        const tempRoute = new TempRoute({
            client_id,
            driver_id,
            vehicle_id,
            route_name,
        })

        await tempRoute.save()

        res.status(200).json({
            message: "Temporary Route created successfully"
        })

    } catch (error) {
        res.status(500).json({ error: "Failed to create Temporary Route", details: error.message });
    }


}

const getTempRoute = async (req, res) => {
    try {
        const client_id = req.user.client_profile_id;
        const { driver_id } = req.body;
        if (req.user.role == "client_driver") {
            if (!driver_id) {
                res.status(404).json({ error: "Driver id is required", details: error.message })
            }
            const allTempRoutes = await TempRoute.find({ client_id, driver_id, status: "created" });
            if (allTempRoutes.length < 1) {
                res.status(200).json({
                    message: "No data found",
                    data: allTempRoutes
                })
            }
            res.status(200).json({
                message: "Data found",
                data: allTempRoutes
            })

        }
        const allTempRoutes = await TempRoute.find({ client_id, status: "created" });
        if (allTempRoutes.length < 1) {
            res.status(200).json({
                message: "No data found",
                data: allTempRoutes
            })
        }
        res.status(200).json({
            message: "Data found",
            data: allTempRoutes
        })

    } catch (error) {
        res.status(500).json({ error: "Failed to fetch Temporary Route", details: error.message });

    }
}

const updateTempRoute = async (req, res) => {
    try {
        const client_id = req.user?.client_profile_id;   // Safe access
        const { route_id } = req.params || req.body;  // Prefer params for ID
        const { route_name, status, ...otherUpdates } = req.body; // Get data from body

        if (!route_id) {
            return res.status(400).json({ message: "Route ID is required" });
        }

        if (!client_id) {
            return res.status(400).json({ message: "Client ID is required" });
        }

        const updatedTempRoute = await TempRoute.findOneAndUpdate(
            {
                _id: route_id,
                client_id: client_id   // Important: Prevent updating others' data
            },
            {
                route_name,
                ...(status && { status }),      // Only update if provided
                ...otherUpdates
            },
            {
                new: true,              // ← Return updated document
                runValidators: true     // ← Run schema validation
            }
        );

        if (!updatedTempRoute) {
            return res.status(404).json({
                message: "Temp Route not found or you don't have access"
            });
        }

        res.status(200).json({
            success: true,
            message: "Temp Route updated successfully",
            data: updatedTempRoute
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to update Temp Route",
            details: error.message
        });
    }
};

const deleteTempRoute = async (req, res) => {
    try {
        const client_id = req.user?.client_profile_id;
        const { route_id } = req.params;

        if (!client_id) {
            return res.status(400).json({ message: "Client ID is required" });
        }
        if (!route_id) {
            return res.status(400).json({ message: "Route ID is required" });
        }

        await TempRoute.findOneAndDelete({ client_id, _id:route_id });
        res.status(200).json({
            message: "Deleted the Temp Route"
        })
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete the route",
            details: error.message
        })
    }
}

module.exports = { createTempRoute, getTempRoute, updateTempRoute, deleteTempRoute }