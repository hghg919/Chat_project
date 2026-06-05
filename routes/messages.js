const express = require("express");
const mongoose = require("mongoose");
// ⭐ [추가] 구글 제미나이 AI 라이브러리를 불러옵니다.
const { GoogleGenerativeAI } = require("@google/generative-ai");

const Message = require("../models/Message");
const Room = require("../models/Room");
const User = require("../models/User");

const router = express.Router();

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

async function isAdminUser(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return false;

  const user = await User.findById(userId);
  if (!user) return false;

  return user.role === "admin";
}

// ⭐ [수정] 자바스크립트 노가다 요약 함수를 지우고, 진짜 구글 AI 연동 비동기 함수로 전면 교체합니다!
async function buildSummary(messages) {
  // 1. 대화방 텍스트 데이터 정제 ("닉네임: 메시지" 형태로 정렬)
  const textMessages = messages
    .filter((msg) => msg.messageType === "text")
    .map((msg) => `${msg.nickname || "익명"}: ${String(msg.message || "").trim()}`)
    .filter((line) => line.length > 0)
    .join("\n");

  const imageCount = messages.filter((msg) => msg.messageType === "image").length; //
  const videoCount = messages.filter((msg) => msg.messageType === "video").length; //

  const participants = Array.from(
    new Set(messages.map((msg) => msg.nickname || "익명"))
  ); //

  // 수치 통계 데이터는 정확성을 위해 서버 단에서 직접 계산하여 UI에 전달합니다
  const stats = {
    totalMessages: messages.length,
    textMessages: messages.filter((msg) => msg.messageType === "text").length,
    imageCount,
    videoCount,
    participantCount: participants.length
  };

  const mediaSummary = [];
  if (imageCount > 0) mediaSummary.push(`사진 ${imageCount}개`); //
  if (videoCount > 0) mediaSummary.push(`동영상 ${videoCount}개`); //

  // 기본값(Fallback) 설정
  let bullets = ["아직 요약할 대화 내용이 충분하지 않습니다."];
  let actionItems = ["특별한 할 일 후보가 없습니다."];
  let keywords = ["채팅"];

  // 2. 대화 내역이 존재하고 API Key가 잘 세팅되어 있다면 진짜 AI 요약을 작동시킵니다.
  if (textMessages.trim().length > 0 && process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      // 최신 고속 모델인 gemini-1.5-flash를 사용하며, UI 손상 방지를 위해 JSON 강제 출력 모드를 활성화합니다.
      // ❌ 기존 코드
      const model = genAI.getGenerativeModel({ 
      model: "gemini-3.5-flash", // 👈 유료 버전 창에 있던 '3.5 Flash' 명칭으로 대치!
      generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
      아래 대학생들의 실시간 채팅 대화 내용을 완벽하게 분석해서 핵심 내용을 요약하고 지정된 JSON 형식으로 반환해줘.
      
      [대화 내용]
      ${textMessages}

      반드시 아래 명시된 JSON 구조로만 정확하게 답변해야 해. 다른 부가 설명 글은 절대 쓰지 마:
      {
        "bullets": ["핵심 요약 문장 1 (친근한 존댓말로)", "핵심 요약 문장 2", "핵심 요약 문장 3"],
        "actionItems": ["누가 무엇을 고치거나 해야 하는지 할 일 1", "할 일 2"],
        "keywords": ["핵심단어1", "핵심단어2", "핵심단어3", "핵심단어4"]
      }
      
      [작성 지침]
      1. 'bullets': 단순 복사 붙여넣기가 아니라 전체 대화 흐름의 맥락을 완벽히 이해하여 중요한 사건이나 논의를 3~4개의 친근한 '~했습니다.' 말투의 문장으로 요약해줘.
      2. 'actionItems': 대화 중 조원들이 '해야 한다', '수정하자', '추가해줘', '문제다'라고 언급한 미래의 계획이나 할 일을 포착하여 "[닉네임] - [할일]" 형태로 가공해줘. 만약 명확한 할 일이 없다면 빈 배열 []로 줘.
      3. 'keywords': 대화에서 의미 중심이 되는 핵심 단어(예: 프로젝트, 오류, 유니티, 기말과제 등)를 조사 없이 '명사' 형태로 최대 6~8개 추출해줘.
      `;

      const aiResult = await model.generateContent(prompt);
      const aiResponseText = aiResult.response.text();
      
      // AI가 응답한 JSON 데이터를 파싱하여 뼈대에 매핑
      const parsedAI = JSON.parse(aiResponseText);
      
      if (parsedAI.bullets && parsedAI.bullets.length > 0) bullets = parsedAI.bullets;
      if (parsedAI.actionItems && parsedAI.actionItems.length > 0) actionItems = parsedAI.actionItems;
      if (parsedAI.keywords && parsedAI.keywords.length > 0) keywords = parsedAI.keywords;

    } catch (aiError) {
      console.error("Gemini AI 요약 처리 중 오류 발생:", aiError);
      bullets = ["[안내] AI 요약 연동 에러가 발생하여 최신 대화 목록으로 대체합니다."];
      bullets.push(...messages.filter(msg => msg.messageType === "text").slice(-3).map(msg => `${msg.nickname}: ${msg.message}`));
    }
  }

  return {
    title: "대화 요약",
    bullets,
    actionItems,
    keywords,
    participants,
    mediaSummary,
    stats,
    createdAt: new Date().toLocaleString("ko-KR")
  };
}

// GET /messages/summary?room=...&userId=...
// 현재 대화방 AI 요약
router.get("/summary", async (req, res) => {
  try {
    const { room, userId } = req.query;

    if (!room || !mongoose.Types.ObjectId.isValid(room)) {
      return res.status(400).json({
        success: false,
        message: "올바른 대화방 정보가 필요합니다."
      });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "사용자 정보가 필요합니다."
      });
    }

    const targetRoom = await Room.findById(room);

    if (!targetRoom) {
      return res.status(404).json({
        success: false,
        message: "대화방을 찾을 수 없습니다."
      });
    }

    const admin = await isAdminUser(userId);

    const isMember = targetRoom.members.some(
      (memberId) => String(memberId) === String(userId)
    );

    if (!admin && !isMember) {
      return res.status(403).json({
        success: false,
        message: "이 대화방의 멤버만 요약할 수 있습니다."
      });
    }

    const recentMessages = await Message.find({ room })
      .sort({ createdAt: -1 })
      .limit(80);

    const messages = recentMessages.reverse();

    // ⭐ [수정] buildSummary 함수가 비동기(AI 호출)로 바뀌었으므로 await를 추가해 줍니다!
    const summary = await buildSummary(messages);

    res.json({
      success: true,
      room: {
        id: String(targetRoom._id),
        name: targetRoom.name
      },
      summary
    });
  } catch (error) {
    console.log("대화 요약 에러:", error);

    res.status(500).json({
      success: false,
      message: "대화 요약 실패: " + error.message
    });
  }
});

// GET /messages
// 전체 또는 특정 방 메시지 조회
router.get("/", async (req, res) => {
  try {
    const room = req.query.room;
    const filter = room ? { room } : {};

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);

    const data = messages.map((msg) => ({
      id: msg._id,
      room: msg.room,
      userId: msg.userId,
      socketId: msg.socketId,
      nickname: msg.nickname,
      message: msg.message,
      messageType: msg.messageType || "text",
      fileUrl: msg.fileUrl || "",
      fileName: msg.fileName || "",
      mimeType: msg.mimeType || "",
      readCount: getReadCount(msg),
      time: msg.time,
      createdAt: msg.createdAt
    }));

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "메시지 조회 실패",
      error: error.message
    });
  }
});

// POST /messages
// 메시지 생성
router.post("/", async (req, res) => {
  try {
    const {
      room,
      userId,
      nickname,
      message,
      messageType,
      fileUrl,
      fileName,
      mimeType
    } = req.body;

    if (!room || !nickname) {
      return res.status(400).json({
        success: false,
        message: "room과 nickname이 필요합니다."
      });
    }

    if ((!message || message.trim() === "") && !fileUrl) {
      return res.status(400).json({
        success: false,
        message: "메시지 또는 파일이 필요합니다."
      });
    }

    const newMessage = await Message.create({
      room,
      userId: userId || "",
      socketId: "REST_API",
      nickname,
      message: message || "",
      messageType: messageType || "text",
      fileUrl: fileUrl || "",
      fileName: fileName || "",
      mimeType: mimeType || "",
      readBy: userId ? [String(userId)] : [],
      time: new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    });

    res.status(201).json({
      success: true,
      message: "메시지 생성 성공",
      data: {
        id: newMessage._id,
        room: newMessage.room,
        userId: newMessage.userId,
        nickname: newMessage.nickname,
        message: newMessage.message,
        messageType: newMessage.messageType,
        fileUrl: newMessage.fileUrl,
        fileName: newMessage.fileName,
        mimeType: newMessage.mimeType,
        readCount: getReadCount(newMessage),
        time: newMessage.time
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "메시지 생성 실패",
      error: error.message
    });
  }
});

// GET /messages/:id
// 특정 메시지 조회
router.get("/:id", async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "메시지를 찾을 수 없습니다."
      });
    }

    res.json({
      success: true,
      data: {
        id: message._id,
        room: message.room,
        userId: message.userId,
        socketId: message.socketId,
        nickname: message.nickname,
        message: message.message,
        messageType: message.messageType || "text",
        fileUrl: message.fileUrl || "",
        fileName: message.fileName || "",
        mimeType: message.mimeType || "",
        readCount: getReadCount(message),
        time: message.time,
        createdAt: message.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "메시지 상세 조회 실패",
      error: error.message
    });
  }
});

// DELETE /messages/:id
// 특정 메시지 삭제
router.delete("/:id", async (req, res) => {
  try {
    const deletedMessage = await Message.findByIdAndDelete(req.params.id);

    if (!deletedMessage) {
      return res.status(404).json({
        success: false,
        message: "삭제할 메시지를 찾을 수 없습니다."
      });
    }

    res.json({
      success: true,
      message: "메시지 삭제 성공",
      data: deletedMessage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "메시지 삭제 실패",
      error: error.message
    });
  }
});

module.exports = router;