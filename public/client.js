const socket = io();

const loginBox = document.getElementById("loginBox");
const chatBox = document.getElementById("chatBox");

const showLoginBtn = document.getElementById("showLoginBtn");
const showRegisterBtn = document.getElementById("showRegisterBtn");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessage = document.getElementById("authMessage");

const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");

const registerUsername = document.getElementById("registerUsername");
const registerNickname = document.getElementById("registerNickname");
const registerPassword = document.getElementById("registerPassword");
const registerPasswordCheck = document.getElementById("registerPasswordCheck");
const registerBtn = document.getElementById("registerBtn");

const currentRoomTitle = document.getElementById("currentRoomTitle");
const adminBadge = document.getElementById("adminBadge");
const summaryBtn = document.getElementById("summaryBtn");
const logoutBtn = document.getElementById("logoutBtn");

const roomList = document.getElementById("roomList");
const newRoomName = document.getElementById("newRoomName");
const createRoomBtn = document.getElementById("createRoomBtn");
const inviteUsername = document.getElementById("inviteUsername");
const inviteBtn = document.getElementById("inviteBtn");
const roomMessage = document.getElementById("roomMessage");

const userCount = document.getElementById("userCount");
const userList = document.getElementById("userList");
const memberList = document.getElementById("memberList");

const messages = document.getElementById("messages");
const typingText = document.getElementById("typingText");

const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");

const emojiBtn = document.getElementById("emojiBtn");
const emojiPicker = document.getElementById("emojiPicker");

const fileBtn = document.getElementById("fileBtn");
const mediaInput = document.getElementById("mediaInput");

const STORAGE_USER_KEY = "chatAppCurrentUser";
const STORAGE_ROOM_KEY = "chatAppCurrentRoom";

let currentUser = null;
let myNickname = "";
let hasJoined = false;
let typingTimer = null;

let rooms = [];
let currentRoom = null;
let currentRoomName = "";

const imageModal = document.createElement("div");
imageModal.className = "image-modal hidden";
imageModal.innerHTML = `
  <button type="button" class="image-modal-close">×</button>
  <img src="" alt="확대 이미지" class="image-modal-img" />
`;
document.body.appendChild(imageModal);

const imageModalImg = imageModal.querySelector(".image-modal-img");
const imageModalClose = imageModal.querySelector(".image-modal-close");

const summaryModal = document.createElement("div");
summaryModal.className = "summary-modal hidden";
summaryModal.innerHTML = `
  <div class="summary-box">
    <div class="summary-header">
      <div>
        <h3>AI 대화 요약</h3>
        <p id="summarySubText">현재 대화방 내용을 요약합니다.</p>
      </div>
      <button type="button" class="summary-close-btn">×</button>
    </div>

    <div id="summaryContent" class="summary-content">
      <p class="summary-loading">요약을 불러오는 중...</p>
    </div>
  </div>
`;
document.body.appendChild(summaryModal);

const summaryCloseBtn = summaryModal.querySelector(".summary-close-btn");
const summaryContent = document.getElementById("summaryContent");
const summarySubText = document.getElementById("summarySubText");

function saveUserSession(user) {
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
}

function saveRoomSession(room) {
  if (!room || !room.id || !room.name) return;

  localStorage.setItem(
    STORAGE_ROOM_KEY,
    JSON.stringify({
      id: room.id,
      name: room.name
    })
  );
}

function getSavedUser() {
  try {
    const saved = localStorage.getItem(STORAGE_USER_KEY);
    if (!saved) return null;

    return JSON.parse(saved);
  } catch (error) {
    return null;
  }
}

function getSavedRoom() {
  try {
    const saved = localStorage.getItem(STORAGE_ROOM_KEY);
    if (!saved) return null;

    return JSON.parse(saved);
  } catch (error) {
    return null;
  }
}

function clearSavedSession() {
  localStorage.removeItem(STORAGE_USER_KEY);
  localStorage.removeItem(STORAGE_ROOM_KEY);
}

function isValidRoom(room) {
  if (!room) return false;
  if (!room.id) return false;
  if (!room.name) return false;

  const name = String(room.name).trim();

  if (name === "") return false;
  if (name === "undefined") return false;
  if (name === "null") return false;

  return true;
}

function isAdmin() {
  return currentUser && currentUser.isAdmin === true;
}

showLoginBtn.addEventListener("click", () => {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");

  showLoginBtn.classList.add("active");
  showRegisterBtn.classList.remove("active");

  showAuthMessage("");
});

showRegisterBtn.addEventListener("click", () => {
  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");

  showRegisterBtn.classList.add("active");
  showLoginBtn.classList.remove("active");

  showAuthMessage("");
});

registerBtn.addEventListener("click", async () => {
  const username = registerUsername.value.trim();
  const nickname = registerNickname.value.trim();
  const password = registerPassword.value.trim();
  const passwordCheck = registerPasswordCheck.value.trim();

  if (!username || !nickname || !password || !passwordCheck) {
    showAuthMessage("모든 항목을 입력하세요.");
    return;
  }

  if (password !== passwordCheck) {
    showAuthMessage("비밀번호가 서로 다릅니다.");
    return;
  }

  try {
    const response = await fetch("/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        nickname,
        password
      })
    });

    const result = await response.json();

    if (!result.success) {
      showAuthMessage(result.message);
      return;
    }

    showAuthMessage(result.message || "회원가입 성공! 이제 로그인하세요.", true);

    registerUsername.value = "";
    registerNickname.value = "";
    registerPassword.value = "";
    registerPasswordCheck.value = "";

    showLoginBtn.click();
  } catch (error) {
    showAuthMessage("회원가입 중 오류가 발생했습니다.");
  }
});

loginBtn.addEventListener("click", async () => {
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();

  if (!username || !password) {
    showAuthMessage("아이디와 비밀번호를 입력하세요.");
    return;
  }

  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const result = await response.json();

    if (!result.success) {
      showAuthMessage(result.message);
      return;
    }

    currentUser = result.user;
    saveUserSession(currentUser);

    await enterChatPage(currentUser.nickname, true);
  } catch (error) {
    showAuthMessage("로그인 중 오류가 발생했습니다.");
  }
});

loginPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loginBtn.click();
  }
});

registerPasswordCheck.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    registerBtn.click();
  }
});

async function enterChatPage(nickname, useSavedRoom = true) {
  myNickname = nickname;

  loginBox.classList.add("hidden");
  chatBox.classList.remove("hidden");

  if (isAdmin()) {
    adminBadge.classList.remove("hidden");
  } else {
    adminBadge.classList.add("hidden");
  }

  await loadRooms();

  if (rooms.length > 0) {
    let roomToJoin = rooms[0];

    if (useSavedRoom) {
      const savedRoom = getSavedRoom();

      if (savedRoom && savedRoom.id) {
        const foundRoom = rooms.find((room) => room.id === savedRoom.id);

        if (foundRoom) {
          roomToJoin = foundRoom;
        }
      }
    }

    joinRoom(roomToJoin);
  } else {
    resetRoomView();

    if (isAdmin()) {
      showRoomMessage("현재 생성된 대화방이 없습니다.", true);
    } else {
      showRoomMessage("아직 대화방이 없습니다. 새 대화방을 만들어보세요.", true);
    }
  }
}

function showAuthMessage(message, success = false) {
  authMessage.textContent = message;

  if (success) {
    authMessage.classList.add("success");
  } else {
    authMessage.classList.remove("success");
  }
}

logoutBtn.addEventListener("click", () => {
  const ok = confirm("로그아웃하시겠습니까?");

  if (!ok) return;

  socket.emit("logout");

  clearSavedSession();

  currentUser = null;
  myNickname = "";
  hasJoined = false;
  typingTimer = null;

  rooms = [];
  currentRoom = null;
  currentRoomName = "";

  loginBox.classList.remove("hidden");
  chatBox.classList.add("hidden");

  messages.innerHTML = "";
  userList.innerHTML = "";
  roomList.innerHTML = "";
  memberList.innerHTML = `<li class="empty-member">대화방을 선택하세요.</li>`;
  userCount.textContent = "0";
  typingText.textContent = "";
  roomMessage.textContent = "";

  messageInput.value = "";
  inviteUsername.value = "";
  newRoomName.value = "";
  mediaInput.value = "";
  emojiPicker.classList.add("hidden");
  adminBadge.classList.add("hidden");

  loginUsername.value = "";
  loginPassword.value = "";

  showLoginBtn.click();
  showAuthMessage("로그아웃되었습니다.", true);

  currentRoomTitle.textContent = "대화방을 선택하세요";
});

async function loadRooms() {
  try {
    const response = await fetch(`/rooms?userId=${currentUser.id}`);
    const result = await response.json();

    if (!result.success) {
      showRoomMessage("방 목록을 불러오지 못했습니다.");
      return;
    }

    rooms = result.data.filter((room) => isValidRoom(room));
    renderRooms();
  } catch (error) {
    showRoomMessage("방 목록 조회 중 오류가 발생했습니다.");
  }
}

function renderRooms() {
  roomList.innerHTML = "";

  if (rooms.length === 0) {
    roomList.innerHTML = `
      <div class="empty-room">
        ${
          isAdmin()
            ? "현재 생성된 대화방이 없습니다."
            : "만든 방 또는 초대받은 방이 없습니다."
        }
      </div>
    `;
    return;
  }

  rooms.forEach((room) => {
    if (!isValidRoom(room)) return;

    const isOwner = String(room.owner) === String(currentUser.id);
    const canDeleteRoom = isOwner || isAdmin();

    const div = document.createElement("div");
    div.className = "room-item";

    div.innerHTML = `
      <button
        type="button"
        class="room-btn ${room.id === currentRoom ? "active" : ""}"
        data-room="${escapeHtml(room.id)}"
        data-room-name="${escapeHtml(room.name)}"
      >
        <span>${escapeHtml(room.name)}</span>
        <em class="room-count" data-room-count="${escapeHtml(room.id)}">0</em>
      </button>

      ${
        canDeleteRoom
          ? `<button type="button" class="delete-room-btn" data-room="${escapeHtml(room.id)}" data-room-name="${escapeHtml(room.name)}">삭제</button>`
          : ""
      }
    `;

    roomList.appendChild(div);
  });
}

async function loadRoomMembers(roomId) {
  if (!roomId || !currentUser) {
    memberList.innerHTML = `<li class="empty-member">대화방을 선택하세요.</li>`;
    return;
  }

  try {
    const response = await fetch(`/rooms/${roomId}/members?userId=${currentUser.id}`);
    const result = await response.json();

    if (!result.success) {
      memberList.innerHTML = `<li class="empty-member">멤버 목록을 불러오지 못했습니다.</li>`;
      return;
    }

    renderMembers(result.members);
  } catch (error) {
    memberList.innerHTML = `<li class="empty-member">멤버 목록 조회 중 오류가 발생했습니다.</li>`;
  }
}

function renderMembers(members) {
  memberList.innerHTML = "";

  if (!members || members.length === 0) {
    memberList.innerHTML = `<li class="empty-member">멤버가 없습니다.</li>`;
    return;
  }

  members.forEach((member) => {
    const li = document.createElement("li");

    li.innerHTML = `
      <span class="member-avatar ${member.isAdmin ? "admin-avatar" : ""}">
        ${escapeHtml(getInitial(member.nickname))}
      </span>

      <div class="member-info">
        <strong>
          ${escapeHtml(member.nickname)}
          ${member.isAdmin ? `<span class="mini-admin-label">관리자</span>` : ""}
        </strong>
        <small>@${escapeHtml(member.username)}</small>
      </div>

      ${member.isOwner ? `<em class="owner-badge">방장</em>` : ""}
    `;

    memberList.appendChild(li);
  });
}

function joinRoom(room) {
  if (!isValidRoom(room)) {
    showRoomMessage("올바르지 않은 대화방입니다.");
    return;
  }

  currentRoom = room.id;
  currentRoomName = room.name;

  saveRoomSession({
    id: currentRoom,
    name: currentRoomName
  });

  setActiveRoom(currentRoom);

  messages.innerHTML = "";
  typingText.textContent = "";
  showRoomMessage("");

  loadRoomMembers(currentRoom);

  if (!hasJoined) {
    socket.emit("join", {
      userId: currentUser.id,
      nickname: myNickname,
      room: currentRoom,
      roomName: currentRoomName,
      isAdmin: isAdmin()
    });

    hasJoined = true;
  } else {
    socket.emit("switch room", {
      userId: currentUser.id,
      nickname: myNickname,
      room: currentRoom,
      roomName: currentRoomName,
      isAdmin: isAdmin()
    });
  }

  messageInput.placeholder = "메시지를 입력하세요";
  messageInput.focus();
}

function setActiveRoom(roomId) {
  document.querySelectorAll(".room-btn").forEach((button) => {
    if (button.dataset.room === roomId) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });

  currentRoomTitle.textContent = currentRoomName || "대화방을 선택하세요";
}

function resetRoomView() {
  currentRoom = null;
  currentRoomName = "";
  hasJoined = false;

  localStorage.removeItem(STORAGE_ROOM_KEY);

  currentRoomTitle.textContent = "대화방을 선택하세요";
  messages.innerHTML = "";
  userList.innerHTML = "";
  memberList.innerHTML = `<li class="empty-member">대화방을 선택하세요.</li>`;
  userCount.textContent = "0";
  typingText.textContent = "";
  messageInput.value = "";
  messageInput.placeholder = "대화방을 선택한 후 메시지를 입력하세요";
}

function showRoomMessage(message, success = false) {
  roomMessage.textContent = message;

  if (success) {
    roomMessage.classList.add("success");
  } else {
    roomMessage.classList.remove("success");
  }
}

roomList.addEventListener("click", async (event) => {
  const deleteBtn = event.target.closest(".delete-room-btn");

  if (deleteBtn) {
    const roomId = deleteBtn.dataset.room;
    const roomName = deleteBtn.dataset.roomName;

    await deleteRoom(roomId, roomName);
    return;
  }

  const button = event.target.closest(".room-btn");

  if (!button) return;

  const selectedRoom = button.dataset.room;
  const selectedRoomName = button.dataset.roomName;

  if (!selectedRoom || !selectedRoomName || selectedRoomName === "undefined") {
    showRoomMessage("올바르지 않은 대화방입니다.");
    return;
  }

  if (selectedRoom === currentRoom) return;

  const room = {
    id: selectedRoom,
    name: selectedRoomName
  };

  joinRoom(room);
});

createRoomBtn.addEventListener("click", async () => {
  const name = newRoomName.value.trim();

  if (!name) {
    showRoomMessage("방 이름을 입력하세요.");
    return;
  }

  if (name === "undefined" || name === "null") {
    showRoomMessage("올바른 방 이름을 입력하세요.");
    return;
  }

  try {
    const response = await fetch("/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        ownerId: currentUser.id
      })
    });

    const result = await response.json();

    if (!result.success) {
      showRoomMessage(result.message);
      return;
    }

    newRoomName.value = "";

    await loadRooms();

    joinRoom(result.data);

    showRoomMessage("대화방을 만들었습니다.", true);
  } catch (error) {
    showRoomMessage("대화방 생성 중 오류가 발생했습니다.");
  }
});

inviteBtn.addEventListener("click", async () => {
  const username = inviteUsername.value.trim();

  if (!username) {
    showRoomMessage("초대할 아이디를 입력하세요.");
    return;
  }

  if (!currentRoom) {
    showRoomMessage("먼저 대화방을 선택하세요.");
    return;
  }

  try {
    const response = await fetch(`/rooms/${currentRoom}/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        inviterId: currentUser.id
      })
    });

    const result = await response.json();

    if (!result.success) {
      showRoomMessage(result.message);
      return;
    }

    inviteUsername.value = "";

    await loadRoomMembers(currentRoom);

    showRoomMessage(result.message, true);
  } catch (error) {
    showRoomMessage("초대 중 오류가 발생했습니다.");
  }
});

async function deleteRoom(roomId, roomName) {
  const message = isAdmin()
    ? `"${roomName}" 대화방을 관리자 권한으로 삭제할까요?`
    : `"${roomName}" 대화방을 삭제할까요?`;

  const ok = confirm(message);

  if (!ok) return;

  try {
    const response = await fetch(`/rooms/${roomId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: currentUser.id
      })
    });

    const result = await response.json();

    if (!result.success) {
      showRoomMessage(result.message);
      return;
    }

    socket.emit("room deleted", {
      room: roomId,
      roomName
    });

    await loadRooms();

    if (currentRoom === roomId) {
      if (rooms.length > 0) {
        joinRoom(rooms[0]);
      } else {
        resetRoomView();
      }
    }

    showRoomMessage(result.message || "대화방이 삭제되었습니다.", true);
  } catch (error) {
    showRoomMessage("대화방 삭제 중 오류가 발생했습니다.");
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!currentRoom || !hasJoined) {
    showRoomMessage("먼저 대화방을 선택하거나 만들어주세요.");
    return;
  }

  const message = messageInput.value.trim();

  if (message.length === 0) return;

  socket.emit("chat message", {
    message,
    messageType: "text"
  });

  socket.emit("typing", false);

  messageInput.value = "";
  emojiPicker.classList.add("hidden");
  messageInput.focus();
});

fileBtn.addEventListener("click", () => {
  if (!currentRoom || !hasJoined) {
    showRoomMessage("먼저 대화방을 선택하거나 만들어주세요.");
    return;
  }

  mediaInput.click();
});

mediaInput.addEventListener("change", async () => {
  const file = mediaInput.files[0];

  if (!file) return;

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  if (!isImage && !isVideo) {
    showRoomMessage("사진 또는 동영상 파일만 보낼 수 있습니다.");
    mediaInput.value = "";
    return;
  }

  const maxSize = 50 * 1024 * 1024;

  if (file.size > maxSize) {
    showRoomMessage("파일 크기는 50MB 이하만 가능합니다.");
    mediaInput.value = "";
    return;
  }

  try {
    showRoomMessage("파일 업로드 중...", true);

    const formData = new FormData();
    formData.append("media", file);

    const response = await fetch("/uploads", {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (!result.success) {
      showRoomMessage(result.message);
      mediaInput.value = "";
      return;
    }

    socket.emit("chat message", {
      message: "",
      messageType: result.file.type,
      fileUrl: result.file.url,
      fileName: result.file.fileName,
      mimeType: result.file.mimeType
    });

    showRoomMessage("파일을 전송했습니다.", true);
    mediaInput.value = "";
  } catch (error) {
    showRoomMessage("파일 업로드 중 오류가 발생했습니다.");
    mediaInput.value = "";
  }
});

messageInput.addEventListener("input", () => {
  if (!currentRoom || !hasJoined) return;

  if (messageInput.value.trim().length > 0) {
    socket.emit("typing", true);
  } else {
    socket.emit("typing", false);
  }

  clearTimeout(typingTimer);

  typingTimer = setTimeout(() => {
    socket.emit("typing", false);
  }, 1000);
});

emojiBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  emojiPicker.classList.toggle("hidden");
});

emojiPicker.addEventListener("click", (event) => {
  if (event.target.tagName !== "BUTTON") return;

  messageInput.value += event.target.textContent;
  messageInput.focus();

  if (currentRoom && hasJoined) {
    socket.emit("typing", true);
  }
});

document.addEventListener("click", (event) => {
  if (!emojiPicker.contains(event.target) && event.target !== emojiBtn) {
    emojiPicker.classList.add("hidden");
  }
});

function openImageModal(src) {
  if (!src) return;

  imageModalImg.src = src;
  imageModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeImageModal() {
  imageModal.classList.add("hidden");
  imageModalImg.src = "";
  document.body.classList.remove("modal-open");
}

imageModalClose.addEventListener("click", closeImageModal);

imageModal.addEventListener("click", (event) => {
  if (event.target === imageModal) {
    closeImageModal();
  }
});

function openSummaryModal() {
  summaryModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeSummaryModal() {
  summaryModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

summaryCloseBtn.addEventListener("click", closeSummaryModal);

summaryModal.addEventListener("click", (event) => {
  if (event.target === summaryModal) {
    closeSummaryModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeImageModal();
    closeSummaryModal();
  }
});

summaryBtn.addEventListener("click", async () => {
  if (!currentRoom || !currentUser) {
    showRoomMessage("먼저 대화방을 선택하세요.");
    return;
  }

  openSummaryModal();

  summarySubText.textContent = `${currentRoomName} 대화방의 최근 메시지를 요약합니다.`;
  summaryContent.innerHTML = `<p class="summary-loading">AI 요약을 생성하는 중...</p>`;

  try {
    const response = await fetch(
      `/messages/summary?room=${encodeURIComponent(currentRoom)}&userId=${encodeURIComponent(currentUser.id)}`
    );

    const result = await response.json();

    if (!result.success) {
      summaryContent.innerHTML = `
        <p class="summary-error">${escapeHtml(result.message)}</p>
      `;
      return;
    }

    renderSummary(result.summary);
  } catch (error) {
    summaryContent.innerHTML = `
      <p class="summary-error">요약을 불러오는 중 오류가 발생했습니다.</p>
    `;
  }
});

function renderSummary(summary) {
  const keywordsHtml =
    summary.keywords && summary.keywords.length > 0
      ? summary.keywords
          .map((keyword) => `<span>${escapeHtml(keyword)}</span>`)
          .join("")
      : `<em>추출된 키워드가 없습니다.</em>`;

  const participantsHtml =
    summary.participants && summary.participants.length > 0
      ? summary.participants.map((name) => escapeHtml(name)).join(", ")
      : "참여자 없음";

  const mediaHtml =
    summary.mediaSummary && summary.mediaSummary.length > 0
      ? summary.mediaSummary.map((item) => escapeHtml(item)).join(", ")
      : "첨부 파일 없음";

  const bulletsHtml = summary.bullets
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const actionItemsHtml =
    summary.actionItems && summary.actionItems.length > 0
      ? summary.actionItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : `<li>특별한 할 일 후보가 없습니다.</li>`;

  summaryContent.innerHTML = `
    <div class="summary-stats">
      <div>
        <strong>${summary.stats.totalMessages}</strong>
        <span>전체 메시지</span>
      </div>
      <div>
        <strong>${summary.stats.participantCount}</strong>
        <span>참여자</span>
      </div>
      <div>
        <strong>${summary.stats.imageCount + summary.stats.videoCount}</strong>
        <span>첨부</span>
      </div>
    </div>

    <div class="summary-section">
      <h4>핵심 요약</h4>
      <ul>${bulletsHtml}</ul>
    </div>

    <div class="summary-section">
      <h4>할 일 / 확인할 내용</h4>
      <ul>${actionItemsHtml}</ul>
    </div>

    <div class="summary-section">
      <h4>주요 키워드</h4>
      <div class="summary-keywords">${keywordsHtml}</div>
    </div>

    <div class="summary-info">
      <p><strong>참여자:</strong> ${participantsHtml}</p>
      <p><strong>첨부:</strong> ${mediaHtml}</p>
      <p><strong>생성 시간:</strong> ${escapeHtml(summary.createdAt)}</p>
    </div>
  `;
}

messages.addEventListener("click", (event) => {
  const deleteBtn = event.target.closest(".delete-message-btn");

  if (deleteBtn) {
    const messageId = deleteBtn.dataset.messageId;

    if (!messageId) return;

    const ok = confirm(
      isAdmin()
        ? "이 메시지를 관리자 권한으로 삭제할까요?"
        : "이 메시지를 삭제할까요?"
    );

    if (!ok) return;

    socket.emit("delete message", {
      messageId
    });

    return;
  }

  const image = event.target.closest(".chat-image");

  if (image) {
    openImageModal(image.src);
  }
});

socket.on("room changed", (data) => {
  currentRoom = data.room;
  currentRoomName = data.roomName;

  saveRoomSession({
    id: currentRoom,
    name: currentRoomName
  });

  setActiveRoom(currentRoom);
  loadRoomMembers(currentRoom);
});

socket.on("room deleted notice", async (data) => {
  hasJoined = false;

  if (data.deletedRoom === currentRoom) {
    localStorage.removeItem(STORAGE_ROOM_KEY);
  }

  await loadRooms();

  if (rooms.length > 0) {
    joinRoom(rooms[0]);
  } else {
    resetRoomView();
  }

  showRoomMessage(`${data.deletedRoomName} 방이 삭제되었습니다.`, false);
});

socket.on("chat history", (history) => {
  messages.innerHTML = "";

  history.forEach((data) => {
    addChatMessage(data);
  });

  if (currentRoom && hasJoined) {
    socket.emit("read room", currentRoom);
  }
});

socket.on("chat message", (data) => {
  if (data.room !== currentRoom) return;

  addChatMessage(data);

  if (currentUser && data.userId !== currentUser.id) {
    socket.emit("read room", currentRoom);
  }
});

socket.on("read updates", (updates) => {
  updateReadCounts(updates);
});

socket.on("delete message result", (result) => {
  if (!result.success) {
    showRoomMessage(result.message);
  }
});

socket.on("message deleted", (data) => {
  document.querySelectorAll(".message").forEach((messageEl) => {
    if (messageEl.dataset.messageId === String(data.messageId)) {
      messageEl.remove();
    }
  });
});

socket.on("system message", (message) => {
  const li = document.createElement("li");
  li.className = "message system";

  li.innerHTML = `
    <div class="system-text">${escapeHtml(message)}</div>
  `;

  messages.appendChild(li);
  scrollToBottom();
});

socket.on("user count", (count) => {
  userCount.textContent = count;
});

socket.on("user list", (users) => {
  userList.innerHTML = "";

  users.forEach((user) => {
    const li = document.createElement("li");

    li.innerHTML = `
      <span class="dot ${user.isAdmin ? "admin-dot" : ""}"></span>
      <span>${escapeHtml(user.nickname)}</span>
      ${user.isAdmin ? `<em class="admin-online">관리자</em>` : ""}
      ${user.id === socket.id ? "<em>나</em>" : ""}
    `;

    userList.appendChild(li);
  });
});

socket.on("room counts", (counts) => {
  document.querySelectorAll(".room-count").forEach((el) => {
    const room = el.dataset.roomCount;
    el.textContent = counts[room] || 0;
  });
});

socket.on("typing", (text) => {
  typingText.textContent = text;
});

function addChatMessage(data) {
  const li = document.createElement("li");

  const isMine =
    currentUser &&
    (String(data.userId || "") === String(currentUser.id) || data.id === socket.id);

  const messageType = data.messageType || "text";
  const messageId = data.messageId || "";

  li.className = `message ${isMine ? "own" : "other"}`;

  if (messageId) {
    li.dataset.messageId = messageId;
  }

  let contentHtml = "";

  if (messageType === "image") {
    contentHtml = `
      <img
        src="${escapeHtml(data.fileUrl)}"
        alt="${escapeHtml(data.fileName || "image")}"
        class="chat-media chat-image"
        title="클릭하면 크게 볼 수 있습니다"
      />
    `;
  } else if (messageType === "video") {
    contentHtml = `
      <video
        src="${escapeHtml(data.fileUrl)}"
        class="chat-media chat-video"
        controls
      ></video>
    `;
  } else {
    contentHtml = escapeHtml(data.message);
  }

  const readStatusHtml =
    isMine && messageId
      ? `<div class="read-status" data-message-id="${escapeHtml(messageId)}">읽음 ${data.readCount || 0}</div>`
      : "";

  const canDelete = messageId && (isMine || isAdmin());

  const deleteButtonHtml = canDelete
    ? `<button type="button" class="delete-message-btn" data-message-id="${escapeHtml(messageId)}">삭제</button>`
    : "";

  li.innerHTML = `
    <div class="avatar ${isAdmin() && isMine ? "admin-avatar" : ""}">
      ${escapeHtml(getInitial(data.nickname))}
    </div>

    <div class="message-content">
      <div class="message-meta">
        ${escapeHtml(data.nickname)} · ${escapeHtml(data.time)}
      </div>

      <div class="message-bubble ${messageType !== "text" ? "media-bubble" : ""}">
        ${contentHtml}
      </div>

      <div class="message-actions">
        ${readStatusHtml}
        ${deleteButtonHtml}
      </div>
    </div>
  `;

  messages.appendChild(li);
  scrollToBottom();
}

function updateReadCounts(updates) {
  if (!Array.isArray(updates)) return;

  updates.forEach((item) => {
    document.querySelectorAll(".read-status").forEach((el) => {
      if (el.dataset.messageId === String(item.messageId)) {
        el.textContent = `읽음 ${item.readCount || 0}`;
      }
    });
  });
}

function getInitial(nickname) {
  return String(nickname || "익명").trim().charAt(0);
}

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function restoreSessionOnRefresh() {
  const savedUser = getSavedUser();

  if (!savedUser || !savedUser.id) {
    return;
  }

  currentUser = savedUser;

  await enterChatPage(currentUser.nickname, true);
  showRoomMessage("새로고침 후 로그인 상태가 유지되었습니다.", true);
}

restoreSessionOnRefresh();