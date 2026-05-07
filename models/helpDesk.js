const mongoose = require("mongoose");

const HelpDeskSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Feedback", "Issue"],
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Resolved"],
      default: "Pending",
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Make it optional just in case it's public, but usually it should be required.
    },
    client_profile_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientProfile",
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HelpDesk", HelpDeskSchema);
