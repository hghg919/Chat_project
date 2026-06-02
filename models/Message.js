const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  room: {
    type: String,
    required: true
  },

  userId: {
    type: String,
    default: ""
  },

  socketId: {
    type: String,
    default: ""
  },

  nickname: {
    type: String,
    required: true
  },

  message: {
    type: String,
    default: ""
  },

  messageType: {
    type: String,
    enum: ["text", "image", "video"],
    default: "text"
  },

  fileUrl: {
    type: String,
    default: ""
  },

  fileName: {
    type: String,
    default: ""
  },

  mimeType: {
    type: String,
    default: ""
  },

  readBy: {
    type: [String],
    default: []
  },

  time: {
    type: String,
    default: ""
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Message =
  mongoose.models.Message || mongoose.model("Message", messageSchema);

module.exports = Message;