const HelpDesk = require("../models/helpDesk");

exports.createSubmission = async (req, res) => {
  try {
    const { type, subject, description, attachment } = req.body;

    if (!type || !subject || !description) {
      return res.status(400).json({ error: "Type, subject, and description are required" });
    }

    if (!["Feedback", "Issue"].includes(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    const newSubmission = new HelpDesk({
      type,
      subject,
      description,
      attachment,
      user_id: req.user.id,
      client_profile_id: req.user.client_profile_id,
    });

    await newSubmission.save();

    return res.status(201).json({
      message: `${type} submitted successfully`,
      data: newSubmission,
    });
  } catch (error) {
    console.error("Error creating Help Desk submission:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getMySubmissions = async (req, res) => {
  try {
    const { type, status } = req.query;

    const query = { user_id: req.user.id };

    if (type && type !== "All") {
      query.type = type;
    }
    
    if (status && status !== "All") {
      query.status = status;
    }

    const submissions = await HelpDesk.find(query).sort({ createdAt: -1 });

    return res.status(200).json({ data: submissions });
  } catch (error) {
    console.error("Error fetching Help Desk submissions:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
