const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],

  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Room = mongoose.models.Room || mongoose.model("Room", roomSchema);

module.exports = Room;