const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.render("index", {
    appTitle: "실시간 채팅앱"
  });
});

module.exports = router;