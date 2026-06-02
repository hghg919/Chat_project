const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");

const router = express.Router();

function getAdminUsername() {
  return String(process.env.ADMIN_USERNAME || "admin").trim();
}

function isAdminUsername(username) {
  return String(username || "").trim() === getAdminUsername();
}

// POST /auth/register
// 회원가입
router.post("/register", async (req, res) => {
  try {
    const { username, nickname, password } = req.body;

    if (!username || !nickname || !password) {
      return res.status(400).json({
        success: false,
        message: "아이디, 닉네임, 비밀번호를 모두 입력하세요."
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        message: "아이디는 3글자 이상이어야 합니다."
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        success: false,
        message: "비밀번호는 4글자 이상이어야 합니다."
      });
    }

    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "이미 사용 중인 아이디입니다."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = isAdminUsername(username) ? "admin" : "user";

    const newUser = await User.create({
      username,
      nickname,
      password: hashedPassword,
      role
    });

    res.status(201).json({
      success: true,
      message: role === "admin" ? "관리자 회원가입 성공" : "회원가입 성공",
      user: {
        id: newUser._id,
        username: newUser.username,
        nickname: newUser.nickname,
        role: newUser.role,
        isAdmin: newUser.role === "admin"
      }
    });
  } catch (error) {
    console.log("회원가입 에러:", error);

    res.status(500).json({
      success: false,
      message: "회원가입 실패: " + error.message
    });
  }
});

// POST /auth/login
// 로그인
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "아이디와 비밀번호를 입력하세요."
      });
    }

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "아이디 또는 비밀번호가 올바르지 않습니다."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "아이디 또는 비밀번호가 올바르지 않습니다."
      });
    }

    if (isAdminUsername(user.username) && user.role !== "admin") {
      user.role = "admin";
      await user.save();
    }

    const isAdmin = user.role === "admin";

    res.json({
      success: true,
      message: isAdmin ? "관리자 로그인 성공" : "로그인 성공",
      user: {
        id: user._id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
        isAdmin
      }
    });
  } catch (error) {
    console.log("로그인 에러:", error);

    res.status(500).json({
      success: false,
      message: "로그인 실패: " + error.message
    });
  }
});

module.exports = router;