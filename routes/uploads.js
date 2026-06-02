const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;

    cb(null, fileName);
  }
});

const fileFilter = (req, file, cb) => {
  const isImage = file.mimetype.startsWith("image/");
  const isVideo = file.mimetype.startsWith("video/");

  if (isImage || isVideo) {
    cb(null, true);
  } else {
    cb(new Error("사진 또는 동영상 파일만 업로드할 수 있습니다."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

// POST /uploads
router.post("/", upload.single("media"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "업로드할 파일이 없습니다."
      });
    }

    const isImage = req.file.mimetype.startsWith("image/");
    const isVideo = req.file.mimetype.startsWith("video/");

    res.json({
      success: true,
      message: "파일 업로드 성공",
      file: {
        url: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        type: isImage ? "image" : isVideo ? "video" : "file"
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "파일 업로드 실패: " + error.message
    });
  }
});

module.exports = router;