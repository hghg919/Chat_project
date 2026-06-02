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

  socketId: String,
  nickname: String,

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

  time: String,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;