const express = require("express");
const mongoose = require("mongoose");

const Room = require("../models/Room");
const User = require("../models/User");
const Message = require("../models/Message");

const router = express.Router();

function isValidRoomName(name) {
  const roomName = String(name || "").trim();

  if (!roomName) return false;
  if (roomName === "undefined") return false;
  if (roomName === "null") return false;

  return true;
}

async function isAdminUser(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return false;

  const user = await User.findById(userId);
  if (!user) return false;

  return user.role === "admin";
}

// GET /rooms?userId=...
// 일반 사용자: 내가 만든 방 또는 초대받은 방만 조회
// 관리자: 모든 방 조회
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({
        success: true,
        data: []
      });
    }

    const admin = await isAdminUser(userId);

    const filter = admin
      ? {}
      : {
          members: userId
        };

    const rooms = await Room.find(filter).sort({ createdAt: -1 });

    const customRooms = rooms
      .filter((room) => isValidRoomName(room.name))
      .map((room) => ({
        id: String(room._id),
        name: String(room.name).trim(),
        type: "custom",
        owner: String(room.owner)
      }));

    res.json({
      success: true,
      isAdmin: admin,
      data: customRooms
    });
  } catch (error) {
    console.log("방 목록 조회 에러:", error);

    res.status(500).json({
      success: false,
      message: "방 목록 조회 실패: " + error.message
    });
  }
});

// GET /rooms/:id/members?userId=...
// 대화방 멤버 목록 조회
router.get("/:id/members", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "올바르지 않은 대화방 ID입니다."
      });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "사용자 정보가 필요합니다."
      });
    }

    const admin = await isAdminUser(userId);

    const room = await Room.findById(id)
      .populate("owner", "username nickname role")
      .populate("members", "username nickname role");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "대화방을 찾을 수 없습니다."
      });
    }

    if (!isValidRoomName(room.name)) {
      return res.status(404).json({
        success: false,
        message: "잘못된 대화방입니다."
      });
    }

    const isMember = room.members.some(
      (member) => String(member._id) === String(userId)
    );

    if (!admin && !isMember) {
      return res.status(403).json({
        success: false,
        message: "이 방의 멤버만 멤버 목록을 볼 수 있습니다."
      });
    }

    const members = room.members.map((member) => ({
      id: String(member._id),
      username: member.username,
      nickname: member.nickname,
      role: member.role || "user",
      isAdmin: member.role === "admin",
      isOwner: String(member._id) === String(room.owner._id)
    }));

    res.json({
      success: true,
      room: {
        id: String(room._id),
        name: room.name,
        owner: String(room.owner._id)
      },
      members
    });
  } catch (error) {
    console.log("멤버 목록 조회 에러:", error);

    res.status(500).json({
      success: false,
      message: "멤버 목록 조회 실패: " + error.message
    });
  }
});

// POST /rooms
// 새 대화방 만들기
router.post("/", async (req, res) => {
  try {
    const { name, ownerId } = req.body;

    const roomName = String(name || "").trim();

    if (!roomName || !ownerId) {
      return res.status(400).json({
        success: false,
        message: "방 이름과 사용자 정보가 필요합니다."
      });
    }

    if (!isValidRoomName(roomName)) {
      return res.status(400).json({
        success: false,
        message: "올바른 방 이름을 입력하세요."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({
        success: false,
        message: "올바르지 않은 사용자 ID입니다."
      });
    }

    const owner = await User.findById(ownerId);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다."
      });
    }

    const newRoom = await Room.create({
      name: roomName.slice(0, 20),
      owner: owner._id,
      members: [owner._id]
    });

    res.status(201).json({
      success: true,
      message: "대화방 생성 성공",
      data: {
        id: String(newRoom._id),
        name: newRoom.name,
        type: "custom",
        owner: String(newRoom.owner)
      }
    });
  } catch (error) {
    console.log("방 생성 에러:", error);

    res.status(500).json({
      success: false,
      message: "방 생성 실패: " + error.message
    });
  }
});

// POST /rooms/:id/invite
// 대화방에 회원 초대하기
router.post("/:id/invite", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, inviterId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "올바르지 않은 대화방 ID입니다."
      });
    }

    if (!username || !inviterId) {
      return res.status(400).json({
        success: false,
        message: "초대할 아이디와 초대한 사용자 정보가 필요합니다."
      });
    }

    const admin = await isAdminUser(inviterId);

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "대화방을 찾을 수 없습니다."
      });
    }

    if (!isValidRoomName(room.name)) {
      return res.status(400).json({
        success: false,
        message: "잘못된 대화방에는 초대할 수 없습니다."
      });
    }

    const isMember = room.members.some(
      (memberId) => String(memberId) === String(inviterId)
    );

    if (!admin && !isMember) {
      return res.status(403).json({
        success: false,
        message: "이 방의 멤버만 초대할 수 있습니다."
      });
    }

    const invitedUser = await User.findOne({ username });

    if (!invitedUser) {
      return res.status(404).json({
        success: false,
        message: "초대할 사용자를 찾을 수 없습니다."
      });
    }

    const alreadyMember = room.members.some(
      (memberId) => String(memberId) === String(invitedUser._id)
    );

    if (alreadyMember) {
      return res.status(409).json({
        success: false,
        message: "이미 초대된 사용자입니다."
      });
    }

    room.members.push(invitedUser._id);
    await room.save();

    res.json({
      success: true,
      message: `${invitedUser.nickname}님을 초대했습니다.`
    });
  } catch (error) {
    console.log("초대 에러:", error);

    res.status(500).json({
      success: false,
      message: "초대 실패: " + error.message
    });
  }
});

// DELETE /rooms/:id
// 일반 사용자: 내가 만든 방만 삭제
// 관리자: 모든 방 삭제 가능
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "올바르지 않은 대화방 ID입니다."
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "사용자 정보가 필요합니다."
      });
    }

    const admin = await isAdminUser(userId);

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "대화방을 찾을 수 없습니다."
      });
    }

    const isOwner = String(room.owner) === String(userId);

    if (!admin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "방을 만든 사람 또는 관리자만 삭제할 수 있습니다."
      });
    }

    await Message.deleteMany({ room: id });
    await Room.findByIdAndDelete(id);

    res.json({
      success: true,
      message: admin && !isOwner ? "관리자가 대화방을 삭제했습니다." : "대화방이 삭제되었습니다.",
      deletedRoom: {
        id: String(room._id),
        name: room.name
      }
    });
  } catch (error) {
    console.log("방 삭제 에러:", error);

    res.status(500).json({
      success: false,
      message: "방 삭제 실패: " + error.message
    });
  }
});

module.exports = router;