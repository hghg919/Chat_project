require("dotenv").config();

const path = require("path");
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const indexRouter = require("./routes/index");
const messagesRouter = require("./routes/messages");
const authRouter = require("./routes/auth");
const roomsRouter = require("./routes/rooms");
const uploadsRouter = require("./routes/uploads");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3003;
const MONGODB_URI = process.env.MONGODB_URI;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", indexRouter);
app.use("/messages", messagesRouter);
app.use("/auth", authRouter);
app.use("/rooms", roomsRouter);
app.use("/uploads", uploadsRouter);

mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000
  })
  .then(() => {
    console.log("MongoDB 연결 성공");
  })
  .catch((error) => {
    console.log("MongoDB 연결 실패:", error.message);
    console.log("MongoDB가 연결되지 않으면 회원가입/로그인/DB 저장은 작동하지 않습니다.");
  });

const users = new Map();

function getReadCount(message) {
  const senderId = String(message.userId || "");
  const readBy = message.readBy || [];

  const readers = new Set(
    readBy
      .map((id) => String(id))
      .filter((id) => id && id !== senderId)
  );

  return readers.size;
}

function getUserListByRoom(room) {
  return Array.from(users.entries())
    .filter(([, user]) => user.room === room)
    .map(([id, user]) => ({
      id,
      userId: user.userId,
      nickname: user.nickname,
      room: user.room,
      isAdmin: user.isAdmin || false
    }));
}

function getRoomCounts() {
  const counts = {};

  users.forEach((user) => {
    counts[user.room] = (counts[user.room] || 0) + 1;
  });

  return counts;
}

async function getChatHistory(room) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return [];
    }

    const recentMessages = await Message.find({ room })
      .sort({ createdAt: -1 })
      .limit(50);

    return recentMessages.reverse().map((msg) => ({
      messageId: String(msg._id),
      id: msg.socketId,
      userId: msg.userId || "",
      room: msg.room,
      nickname: msg.nickname,
      message: msg.message,
      messageType: msg.messageType || "text",
      fileUrl: msg.fileUrl || "",
      fileName: msg.fileName || "",
      mimeType: msg.mimeType || "",
      readCount: getReadCount(msg),
      time: msg.time
    }));
  } catch (error) {
    console.log("채팅 기록 불러오기 실패:", error.message);
    return [];
  }
}

async function markRoomAsRead(room, userId) {
  try {
    if (mongoose.connection.readyState !== 1) return;
    if (!room || !userId) return;

    await Message.updateMany(
      {
        room,
        userId: { $ne: String(userId) },
        readBy: { $ne: String(userId) }
      },
      {
        $addToSet: {
          readBy: String(userId)
        }
      }
    );

    await emitReadUpdates(room);
  } catch (error) {
    console.log("읽음 처리 실패:", error.message);
  }
}

async function emitReadUpdates(room) {
  try {
    if (mongoose.connection.readyState !== 1) return;

    const messages = await Message.find({ room })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("_id userId readBy");

    const updates = messages.map((msg) => ({
      messageId: String(msg._id),
      readCount: getReadCount(msg)
    }));

    io.to(room).emit("read updates", updates);
  } catch (error) {
    console.log("읽음 갱신 실패:", error.message);
  }
}

function emitRoomState(room) {
  const roomUsers = getUserListByRoom(room);

  io.to(room).emit("user count", roomUsers.length);
  io.to(room).emit("user list", roomUsers);
  io.emit("room counts", getRoomCounts());
}

io.on("connection", (socket) => {
  console.log("사용자 접속:", socket.id);

  socket.emit("room counts", getRoomCounts());

  socket.on("join", async (data) => {
    if (users.has(socket.id)) return;

    const nickname = String(data.nickname || "익명").trim().slice(0, 12);
    const room = String(data.room || "");
    const roomName = String(data.roomName || "대화방");
    const userId = data.userId || null;
    const isAdmin = Boolean(data.isAdmin);

    if (!room) return;

    users.set(socket.id, {
      userId,
      nickname: nickname || "익명",
      room,
      roomName,
      isAdmin
    });

    socket.join(room);

    const chatHistory = await getChatHistory(room);

    socket.emit("chat history", chatHistory);
    socket.emit("room changed", {
      room,
      roomName
    });

    io.to(room).emit(
      "system message",
      `${users.get(socket.id).nickname}님이 ${roomName}에 입장했습니다.`
    );

    emitRoomState(room);

    if (userId) {
      await markRoomAsRead(room, userId);
    }
  });

  socket.on("switch room", async (data) => {
    const user = users.get(socket.id);

    const nextRoom = String(data.room || "");
    const nextRoomName = String(data.roomName || "대화방");

    if (!nextRoom) return;

    if (!user) {
      const nickname = String(data.nickname || "익명").trim().slice(0, 12);
      const userId = data.userId || null;
      const isAdmin = Boolean(data.isAdmin);

      users.set(socket.id, {
        userId,
        nickname: nickname || "익명",
        room: nextRoom,
        roomName: nextRoomName,
        isAdmin
      });

      socket.join(nextRoom);

      const chatHistory = await getChatHistory(nextRoom);

      socket.emit("chat history", chatHistory);
      socket.emit("room changed", {
        room: nextRoom,
        roomName: nextRoomName
      });

      io.to(nextRoom).emit(
        "system message",
        `${nickname || "익명"}님이 ${nextRoomName}에 입장했습니다.`
      );

      emitRoomState(nextRoom);

      if (userId) {
        await markRoomAsRead(nextRoom, userId);
      }

      return;
    }

    const oldRoom = user.room;
    const oldRoomName = user.roomName;

    if (oldRoom === nextRoom) return;

    socket.leave(oldRoom);

    io.to(oldRoom).emit(
      "system message",
      `${user.nickname}님이 ${oldRoomName}에서 나갔습니다.`
    );

    emitRoomState(oldRoom);

    user.room = nextRoom;
    user.roomName = nextRoomName;

    users.set(socket.id, user);

    socket.join(nextRoom);

    const chatHistory = await getChatHistory(nextRoom);

    socket.emit("chat history", chatHistory);
    socket.emit("room changed", {
      room: nextRoom,
      roomName: nextRoomName
    });

    io.to(nextRoom).emit(
      "system message",
      `${user.nickname}님이 ${nextRoomName}에 입장했습니다.`
    );

    emitRoomState(nextRoom);

    if (user.userId) {
      await markRoomAsRead(nextRoom, user.userId);
    }
  });

  socket.on("room deleted", async (data) => {
    const deletedRoom = String(data.room || "");
    const deletedRoomName = String(data.roomName || "삭제된 대화방");

    if (!deletedRoom) return;

    users.forEach((user, socketId) => {
      if (user.room === deletedRoom) {
        const targetSocket = io.sockets.sockets.get(socketId);

        if (targetSocket) {
          targetSocket.leave(deletedRoom);

          users.delete(socketId);

          targetSocket.emit("chat history", []);
          targetSocket.emit("room deleted notice", {
            deletedRoom,
            deletedRoomName
          });
        }
      }
    });

    io.emit("room counts", getRoomCounts());
  });

  socket.on("chat message", async (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    let cleanMessage = "";
    let messageType = "text";
    let fileUrl = "";
    let fileName = "";
    let mimeType = "";

    if (typeof data === "string") {
      cleanMessage = data.trim();
    } else {
      cleanMessage = String(data.message || "").trim();
      messageType = data.messageType || "text";
      fileUrl = data.fileUrl || "";
      fileName = data.fileName || "";
      mimeType = data.mimeType || "";
    }

    if (messageType === "text" && cleanMessage.length === 0) return;
    if (cleanMessage.length > 200) return;

    if ((messageType === "image" || messageType === "video") && !fileUrl) {
      return;
    }

    let savedMessage = null;

    const chatData = {
      messageId: "",
      id: socket.id,
      userId: user.userId || "",
      room: user.room,
      nickname: user.nickname,
      message: cleanMessage,
      messageType,
      fileUrl,
      fileName,
      mimeType,
      readCount: 0,
      time: new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    try {
      if (mongoose.connection.readyState === 1) {
        savedMessage = await Message.create({
          room: user.room,
          userId: user.userId || "",
          socketId: socket.id,
          nickname: user.nickname,
          message: cleanMessage,
          messageType,
          fileUrl,
          fileName,
          mimeType,
          readBy: user.userId ? [String(user.userId)] : [],
          time: chatData.time
        });

        chatData.messageId = String(savedMessage._id);
        chatData.readCount = getReadCount(savedMessage);
      }
    } catch (error) {
      console.log("메시지 저장 실패:", error.message);
    }

    io.to(user.room).emit("chat message", chatData);
  });

  socket.on("delete message", async (data) => {
    try {
      const user = users.get(socket.id);
      if (!user) return;

      const messageId = String(data.messageId || "");

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        socket.emit("delete message result", {
          success: false,
          message: "올바르지 않은 메시지입니다."
        });
        return;
      }

      const message = await Message.findById(messageId);

      if (!message) {
        socket.emit("delete message result", {
          success: false,
          message: "메시지를 찾을 수 없습니다."
        });
        return;
      }

      const isMine = String(message.userId) === String(user.userId);
      const isAdmin = Boolean(user.isAdmin);

      if (!isAdmin && !isMine) {
        socket.emit("delete message result", {
          success: false,
          message: "본인 메시지 또는 관리자만 삭제할 수 있습니다."
        });
        return;
      }

      await Message.findByIdAndDelete(messageId);

      io.to(message.room).emit("message deleted", {
        messageId,
        deletedByAdmin: isAdmin && !isMine
      });
    } catch (error) {
      console.log("메시지 삭제 실패:", error.message);

      socket.emit("delete message result", {
        success: false,
        message: "메시지 삭제 실패: " + error.message
      });
    }
  });

  socket.on("read room", async (roomId) => {
    const user = users.get(socket.id);
    if (!user || !user.userId) return;

    const room = String(roomId || user.room);

    if (room !== user.room) return;

    await markRoomAsRead(room, user.userId);
  });

  socket.on("typing", (isTyping) => {
    const user = users.get(socket.id);
    if (!user) return;

    if (isTyping) {
      socket.to(user.room).emit("typing", `${user.nickname}님이 입력 중...`);
    } else {
      socket.to(user.room).emit("typing", "");
    }
  });

  socket.on("logout", () => {
    const user = users.get(socket.id);

    if (!user) return;

    users.delete(socket.id);
    socket.leave(user.room);

    io.to(user.room).emit(
      "system message",
      `${user.nickname}님이 로그아웃했습니다.`
    );

    socket.to(user.room).emit("typing", "");

    emitRoomState(user.room);

    console.log("사용자 로그아웃:", socket.id);
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);

    if (user) {
      users.delete(socket.id);

      io.to(user.room).emit("system message", `${user.nickname}님이 퇴장했습니다.`);
      socket.to(user.room).emit("typing", "");

      emitRoomState(user.room);
    }

    console.log("사용자 퇴장:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`${PORT}번 포트가 이미 사용 중입니다.`);
    console.log(".env 파일에서 PORT 번호를 3004 또는 3005로 바꿔보세요.");
  } else {
    console.log("서버 오류:", error.message);
  }
});