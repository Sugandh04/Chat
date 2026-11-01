// Multi-Mode Chat Application
// FLAG ON (Default): WhatsApp UI (Header + Chats + Add New Option, No bots, No channels, No live chat clutter)
// FLAG OFF: PulseChat UI (Community channels, live sockets, reactions, bot capabilities)

const SERVER_HOST = window.location.hostname || "localhost";
const API_BASE = `http://${SERVER_HOST}:5000/api`;
const SOCKET_URL = `http://${SERVER_HOST}:5000`;

// ==========================================
// 🚩 UI MODE FLAG CONFIGURATION
// ==========================================
// Set WHATSAPP_MODE = true for WhatsApp UI (Flag ON)
// Set WHATSAPP_MODE = false for PulseChat UI (Flag OFF)
let WHATSAPP_MODE = true;

// Check stored user preference (defaults to WhatsApp mode if not explicitly set)
const savedMode = localStorage.getItem("chat_ui_mode");
if (savedMode !== null) {
  WHATSAPP_MODE = savedMode === "whatsapp";
}

// User state
let currentUser = {
  id: "user-sugan",
  displayName: "Sugan",
  avatar: "⚡",
};

// Common HTTP fetcher
async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "x-user-id": currentUser.id,
    "x-user-name": currentUser.displayName,
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

function initUser() {
  const saved = localStorage.getItem("pulse_user");
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
    } catch (_) {}
  } else {
    currentUser = {
      id: "user-sugan",
      displayName: "Sugan",
      avatar: "⚡",
    };
    localStorage.setItem("pulse_user", JSON.stringify(currentUser));
  }
}

// ==========================================
// 📱 PART 1: WHATSAPP-STYLE UI CONTROLLER
// (Active when Flag is ON)
// ==========================================
let waActiveContact = null;
let waActiveConversationId = null;
let waContacts = [];
let waMessages = [];

// DOM Elements for WhatsApp UI
const whatsappView = document.getElementById("whatsappView");
const pulsechatView = document.getElementById("pulsechatView");
const btnModeWhatsApp = document.getElementById("btnModeWhatsApp");
const btnModePulse = document.getElementById("btnModePulse");

const waCurrentUserAvatar = document.getElementById("waCurrentUserAvatar");
const waNewChatBtn = document.getElementById("waNewChatBtn");
const waFabNewChat = document.getElementById("waFabNewChat");
const waSearchInput = document.getElementById("waSearchInput");
const waSearchClear = document.getElementById("waSearchClear");
const waFilterTabs = document.querySelectorAll(".wa-filter-tab");
const waChatsList = document.getElementById("waChatsList");

const waEmptyState = document.getElementById("waEmptyState");
const waActiveChat = document.getElementById("waActiveChat");
const waChatPane = document.getElementById("waChatPane");
const waMobileBackBtn = document.getElementById("waMobileBackBtn");
const waContactAvatar = document.getElementById("waContactAvatar");
const waContactName = document.getElementById("waContactName");
const waContactStatus = document.getElementById("waContactStatus");
const waClearCurrentChatBtn = document.getElementById("waClearCurrentChatBtn");
const waChatBody = document.getElementById("waChatBody");
const waBubblesStream = document.getElementById("waBubblesStream");

const waComposerForm = document.getElementById("waComposerForm");
const waMessageInput = document.getElementById("waMessageInput");
const waEmojiPickerBtn = document.getElementById("waEmojiPickerBtn");

// WhatsApp New Chat Modal Elements
const waNewChatModal = document.getElementById("waNewChatModal");
const waCloseNewChatModal = document.getElementById("waCloseNewChatModal");
const waCancelNewChat = document.getElementById("waCancelNewChat");
const waNewChatForm = document.getElementById("waNewChatForm");
const waNewContactName = document.getElementById("waNewContactName");
const waAvatarGrid = document.getElementById("waAvatarGrid");

// Apply UI Mode Flag
function setUIMode(isWhatsApp) {
  WHATSAPP_MODE = isWhatsApp;
  localStorage.setItem("chat_ui_mode", isWhatsApp ? "whatsapp" : "pulse");

  if (WHATSAPP_MODE) {
    whatsappView.style.display = "flex";
    pulsechatView.style.display = "none";
    btnModeWhatsApp.classList.add("active");
    btnModePulse.classList.remove("active");
    document.title = "WhatsApp Web";
    loadWhatsAppChats();
  } else {
    whatsappView.style.display = "none";
    pulsechatView.style.display = "flex";
    btnModeWhatsApp.classList.remove("active");
    btnModePulse.classList.add("active");
    document.title = "PulseChat — Community & Channels";
    initPulseChat();
  }
}

// Mode Switcher Listeners
btnModeWhatsApp.addEventListener("click", () => setUIMode(true));
btnModePulse.addEventListener("click", () => setUIMode(false));

// Load WhatsApp Chats (Pure 1-on-1 chats, No bots, No channels)
async function loadWhatsAppChats() {
  waCurrentUserAvatar.textContent = currentUser.avatar;

  try {
    const data = await apiRequest("/chats/users");
    // Filter out bots and current user
    const humanUsers = (data.users || []).filter(
      (u) =>
        u.id !== currentUser.id &&
        !u.id.toLowerCase().includes("bot") &&
        !u.displayName.toLowerCase().includes("bot") &&
        !u.displayName.toLowerCase().includes("spark ai")
    );

    // If no human contacts exist yet, ensure default friendly contacts exist
    if (humanUsers.length === 0) {
      humanUsers.push(
        { id: "user-alex", displayName: "Alex Rivera", avatar: "🎨", status: "online" },
        { id: "user-emma", displayName: "Emma Watson", avatar: "👩", status: "online" },
        { id: "user-david", displayName: "David Miller", avatar: "🧑‍💻", status: "offline" }
      );
    }

    waContacts = humanUsers;
    renderWhatsAppChatsList(waContacts);

    // Select the first contact if none is active
    if (!waActiveContact && waContacts.length > 0) {
      selectWhatsAppContact(waContacts[0]);
    }
  } catch (err) {
    console.error("Failed to load WhatsApp contacts:", err);
  }
}

function renderWhatsAppChatsList(contactsList) {
  waChatsList.innerHTML = "";

  if (contactsList.length === 0) {
    waChatsList.innerHTML = `
      <div style="padding: 2rem 1rem; text-align: center; color: #8696a0; font-size: 0.9rem;">
        No chats found.<br/>Tap <strong>+ Add New</strong> above to start a chat.
      </div>
    `;
    return;
  }

  contactsList.forEach((contact) => {
    const dmKey = `dm:${[currentUser.id, contact.id].sort().join(":")}`;
    const isActive = waActiveConversationId === dmKey;

    const item = document.createElement("div");
    item.className = `wa-chat-item ${isActive ? "active" : ""}`;
    item.id = `wa-item-${contact.id}`;

    // Get time or default
    const timeFormatted = "10:45 AM";

    item.innerHTML = `
      <div class="wa-item-avatar">${contact.avatar || "👤"}</div>
      <div class="wa-item-info">
        <div class="wa-item-top">
          <span class="wa-item-name">${escapeHtml(contact.displayName)}</span>
          <span class="wa-item-time">${timeFormatted}</span>
        </div>
        <div class="wa-item-bottom">
          <div class="wa-last-msg-preview">
            <span class="wa-check-icon">✓✓</span>
            <span class="wa-preview-text" id="wa-preview-${contact.id}">Tap to message</span>
          </div>
        </div>
      </div>
    `;

    item.addEventListener("click", () => selectWhatsAppContact(contact));
    waChatsList.appendChild(item);
  });
}

// Select a contact and load WhatsApp messages
async function selectWhatsAppContact(contact) {
  waActiveContact = contact;
  waActiveConversationId = `dm:${[currentUser.id, contact.id].sort().join(":")}`;

  // Update active style in list
  document.querySelectorAll(".wa-chat-item").forEach((el) => el.classList.remove("active"));
  const currentItem = document.getElementById(`wa-item-${contact.id}`);
  if (currentItem) currentItem.classList.add("active");

  // Show active chat pane
  waEmptyState.classList.add("hidden");
  waActiveChat.classList.remove("hidden");
  waChatPane.classList.add("mobile-active");

  // Set header
  waContactAvatar.textContent = contact.avatar || "👤";
  waContactName.textContent = contact.displayName;
  waContactStatus.textContent = contact.status === "online" ? "online" : "last seen recently";

  // Join room in socket
  if (socket && socket.connected) {
    socket.emit("join_channel", { targetId: waActiveConversationId });
  }

  // Load conversation messages
  await loadWhatsAppMessages();
  waMessageInput.focus();
}

async function loadWhatsAppMessages() {
  if (!waActiveConversationId) return;

  try {
    const data = await apiRequest(`/chats/conversations/${waActiveConversationId}/messages`);
    const newMsgs = data.messages || [];

    // Avoid clearing if already up to date
    if (JSON.stringify(newMsgs.map(m => m.id)) !== JSON.stringify(waMessages.map(m => m.id))) {
      waMessages = newMsgs;
      waBubblesStream.innerHTML = "";

      if (waMessages.length === 0) {
        waBubblesStream.innerHTML = `
          <div class="wa-bubble theirs" style="align-self: center; background: #182229; font-size: 0.8rem; color: #8696a0;">
            Say hello to ${escapeHtml(waActiveContact.displayName)}! 👋
          </div>
        `;
      } else {
        waMessages.forEach((msg) => appendWhatsAppBubble(msg));
        const last = waMessages[waMessages.length - 1];
        const previewEl = document.getElementById(`wa-preview-${waActiveContact.id}`);
        if (previewEl) {
          previewEl.textContent = last.text.slice(0, 32);
        }
      }
      scrollWhatsAppToBottom();
    }
  } catch (err) {
    console.error("Failed to load WhatsApp messages:", err);
  }
}

function appendWhatsAppBubble(msg) {
  const isMe = msg.senderId === currentUser.id;

  const bubble = document.createElement("div");
  bubble.className = `wa-bubble ${isMe ? "mine" : "theirs"}`;
  bubble.id = `wa-msg-${msg.id}`;

  const timeStr = formatWhatsAppTime(msg.createdAt);

  bubble.innerHTML = `
    <div class="wa-bubble-text">${escapeHtml(msg.text)}</div>
    <div class="wa-bubble-meta">
      <span class="wa-bubble-time">${timeStr}</span>
      ${isMe ? '<span class="wa-tick-read">✓✓</span>' : ''}
    </div>
  `;

  waBubblesStream.appendChild(bubble);
}

function scrollWhatsAppToBottom() {
  waChatBody.scrollTop = waChatBody.scrollHeight;
}

// WhatsApp Message Send Form
waComposerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = waMessageInput.value.trim();
  if (!text || !waActiveConversationId) return;

  waMessageInput.value = "";

  const payload = {
    targetId: waActiveConversationId,
    text,
    senderId: currentUser.id,
    senderName: currentUser.displayName,
    senderAvatar: currentUser.avatar,
  };

  // Optimistic UI append
  const tempMsg = {
    id: "temp-" + Date.now(),
    text,
    senderId: currentUser.id,
    createdAt: new Date().toISOString(),
  };
  appendWhatsAppBubble(tempMsg);
  scrollWhatsAppToBottom();

  // Update last message in sidebar
  const previewEl = document.getElementById(`wa-preview-${waActiveContact.id}`);
  if (previewEl) {
    previewEl.textContent = text.slice(0, 32);
  }

  try {
    const data = await apiRequest(`/chats/conversations/${waActiveConversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (data.message) {
      // Replace temp bubble with confirmed message
      const tempEl = document.getElementById(`wa-msg-${tempMsg.id}`);
      if (tempEl) tempEl.id = `wa-msg-${data.message.id}`;
    }

    if (socket && socket.connected) {
      socket.emit("send_message", payload);
    }
  } catch (err) {
    console.error("Failed to send WhatsApp message:", err);
  }
});

// Click avatar in WhatsApp header to customize your name
waCurrentUserAvatar.addEventListener("click", () => {
  const newName = prompt("Enter your display name:", currentUser.displayName);
  if (newName && newName.trim()) {
    currentUser.displayName = newName.trim();
    localStorage.setItem("pulse_user", JSON.stringify(currentUser));
    waCurrentUserAvatar.textContent = currentUser.avatar;
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(currentUser),
    }).catch(() => {});
    loadWhatsAppChats();
  }
});

// Periodic background sync for WhatsApp messages
setInterval(() => {
  if (WHATSAPP_MODE && waActiveConversationId) {
    loadWhatsAppMessages();
  }
}, 3500);


// Mobile Back Button
waMobileBackBtn.addEventListener("click", () => {
  waChatPane.classList.remove("mobile-active");
});

// Clear WhatsApp Chat
waClearCurrentChatBtn.addEventListener("click", () => {
  if (confirm(`Clear messages with ${waActiveContact.displayName}?`)) {
    waBubblesStream.innerHTML = "";
    const previewEl = document.getElementById(`wa-preview-${waActiveContact.id}`);
    if (previewEl) previewEl.textContent = "Chat cleared";
  }
});

// Search in WhatsApp chats
waSearchInput.addEventListener("input", () => {
  const query = waSearchInput.value.toLowerCase().trim();
  waSearchClear.classList.toggle("hidden", query.length === 0);

  const filtered = waContacts.filter((c) =>
    c.displayName.toLowerCase().includes(query)
  );
  renderWhatsAppChatsList(filtered);
});

waSearchClear.addEventListener("click", () => {
  waSearchInput.value = "";
  waSearchClear.classList.add("hidden");
  renderWhatsAppChatsList(waContacts);
});

// WhatsApp Filter Tabs (All, Unread, Contacts)
waFilterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    waFilterTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
  });
});

// "+ Add New" WhatsApp Modal Handlers
function openWaNewChatModal() {
  waNewContactName.value = "";
  waNewChatModal.classList.remove("hidden");
  waNewContactName.focus();
}

function closeWaNewChatModal() {
  waNewChatModal.classList.add("hidden");
}

waNewChatBtn.addEventListener("click", openWaNewChatModal);
waFabNewChat.addEventListener("click", openWaNewChatModal);
waCloseNewChatModal.addEventListener("click", closeWaNewChatModal);
waCancelNewChat.addEventListener("click", closeWaNewChatModal);

waAvatarGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".wa-avatar-cell");
  if (btn) {
    waAvatarGrid.querySelectorAll(".wa-avatar-cell").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
  }
});

waNewChatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = waNewContactName.value.trim();
  if (!name) return;

  const selectedBtn = waAvatarGrid.querySelector(".wa-avatar-cell.selected");
  const avatar = selectedBtn ? selectedBtn.dataset.avatar : "👤";

  // Create or add contact
  const newContactId = "user-" + Math.random().toString(36).substring(2, 8);
  const newContact = {
    id: newContactId,
    displayName: name,
    avatar,
    status: "online",
  };

  waContacts.unshift(newContact);
  renderWhatsAppChatsList(waContacts);
  selectWhatsAppContact(newContact);
  closeWaNewChatModal();

  // Register in backend storage
  apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ userId: newContactId, displayName: name, avatar }),
  }).catch(() => {});
});

waEmojiPickerBtn.addEventListener("click", () => {
  const emojis = ["😀", "❤️", "👍", "🔥", "🎉", "🙌", "😊", "🚀", "✨"];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  waMessageInput.value += randomEmoji;
  waMessageInput.focus();
});

function formatWhatsAppTime(isoString) {
  if (!isoString) return "Just now";
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ==========================================
// ⚡ PART 2: PULSECHAT UI CONTROLLER
// (Active when Flag is OFF — 100% Preserved)
// ==========================================
let pulseCurrentTarget = {
  type: "channel",
  id: "general",
  name: "general",
  desc: "Welcome to PulseChat! Open discussion for everyone.",
};
let pulseChannels = [];
let pulseOnlineUsers = [];
let pulseMessages = [];
let socket = null;
let soundEnabled = true;
let typingTimeout = null;
let attachedMediaUrl = null;

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playSound(type = "sent") {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === "sent") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.09);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.06);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch (_) {}
}

// PulseChat DOM Elements
const connectionBadge = document.getElementById("connectionBadge");
const connectionLabel = document.getElementById("connectionLabel");
const currentUserAvatar = document.getElementById("currentUserAvatar");
const currentUserName = document.getElementById("currentUserName");
const channelsList = document.getElementById("channelsList");
const dmList = document.getElementById("dmList");
const onlineMembersList = document.getElementById("onlineMembersList");
const panelMemberCount = document.getElementById("panelMemberCount");
const onlineCountLabel = document.getElementById("onlineCountLabel");

const targetSymbol = document.getElementById("targetSymbol");
const targetTitle = document.getElementById("targetTitle");
const targetDesc = document.getElementById("targetDesc");
const panelTargetDesc = document.getElementById("panelTargetDesc");
const welcomeHeading = document.getElementById("welcomeHeading");
const welcomeSubtext = document.getElementById("welcomeSubtext");

const messagesContainer = document.getElementById("messagesContainer");
const messagesStream = document.getElementById("messagesStream");
const typingIndicator = document.getElementById("typingIndicator");
const typingText = document.getElementById("typingText");

const composerForm = document.getElementById("composerForm");
const messageInput = document.getElementById("messageInput");
const emojiBtn = document.getElementById("emojiBtn");
const emojiTray = document.getElementById("emojiTray");
const emojiGrid = document.getElementById("emojiGrid");
const closeEmojiTrayBtn = document.getElementById("closeEmojiTrayBtn");

const attachBtn = document.getElementById("attachBtn");
const attachTray = document.getElementById("attachTray");
const closeAttachTrayBtn = document.getElementById("closeAttachTrayBtn");
const mediaUrlInput = document.getElementById("mediaUrlInput");
const applyAttachBtn = document.getElementById("applyAttachBtn");
const mediaPreviewChip = document.getElementById("mediaPreviewChip");
const removeMediaPreviewBtn = document.getElementById("removeMediaPreviewBtn");

const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const soundToggleBtn = document.getElementById("soundToggleBtn");
const soundIcon = document.getElementById("soundIcon");
const soundLabel = document.getElementById("soundLabel");

const rightPanel = document.getElementById("rightPanel");
const toggleMembersPanelBtn = document.getElementById("toggleMembersPanelBtn");
const closeRightPanelBtn = document.getElementById("closeRightPanelBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const sidebar = document.getElementById("sidebar");

// PulseChat Modals
const profileModal = document.getElementById("profileModal");
const userProfileCard = document.getElementById("userProfileCard");
const editProfileBtn = document.getElementById("editProfileBtn");
const closeProfileModalBtn = document.getElementById("closeProfileModalBtn");
const cancelProfileBtn = document.getElementById("cancelProfileBtn");
const profileForm = document.getElementById("profileForm");
const displayNameInput = document.getElementById("displayNameInput");
const avatarPickerGrid = document.getElementById("avatarPickerGrid");
const switchUserQuickBtn = document.getElementById("switchUserQuickBtn");

const channelModal = document.getElementById("channelModal");
const newChannelBtn = document.getElementById("newChannelBtn");
const closeChannelModalBtn = document.getElementById("closeChannelModalBtn");
const cancelChannelBtn = document.getElementById("cancelChannelBtn");
const channelForm = document.getElementById("channelForm");
const newChannelNameInput = document.getElementById("newChannelNameInput");
const newChannelDescInput = document.getElementById("newChannelDescInput");

function initPulseChat() {
  currentUserAvatar.textContent = currentUser.avatar;
  currentUserName.textContent = currentUser.displayName;
  initPulseSocket();
  loadPulseChannels();
  loadPulseDmUsers();
  loadPulseMessages();
}

function initPulseSocket() {
  if (typeof io === "undefined" || socket) return;

  socket = io(SOCKET_URL, { withCredentials: true });

  socket.on("connect", () => {
    connectionBadge.classList.remove("disconnected");
    connectionLabel.textContent = "Live Online";
    socket.emit("user_connected", {
      userId: currentUser.id,
      displayName: currentUser.displayName,
      avatar: currentUser.avatar,
    });
    joinPulseRoom();
  });

  socket.on("disconnect", () => {
    connectionBadge.classList.add("disconnected");
    connectionLabel.textContent = "Reconnecting...";
  });

  socket.on("presence_update", ({ users, onlineUserIds }) => {
    if (Array.isArray(users)) {
      pulseOnlineUsers = users;
      renderPulseOnlineLists(onlineUserIds);
    }
  });

  socket.on("new_message", (message) => {
    // If in WhatsApp mode
    if (WHATSAPP_MODE && waActiveConversationId === message.targetId) {
      if (!waMessages.some((m) => m.id === message.id)) {
        waMessages.push(message);
        appendWhatsAppBubble(message);
        scrollWhatsAppToBottom();
      }
      const previewEl = document.getElementById(`wa-preview-${message.senderId}`);
      if (previewEl) previewEl.textContent = message.text.slice(0, 32);
      return;
    }

    // If in PulseChat mode
    if (message.targetId === pulseCurrentTarget.id) {
      if (!pulseMessages.some((m) => m.id === message.id)) {
        pulseMessages.push(message);
        appendPulseMessageCard(message);
        scrollPulseToBottom();
        if (message.senderId !== currentUser.id) playSound("received");
      }
    }
  });


  socket.on("reaction_updated", ({ messageId, reactions }) => {
    const msg = pulseMessages.find((m) => m.id === messageId);
    if (msg) {
      msg.reactions = reactions;
      updatePulseMessageReactions(messageId, reactions);
    }
  });

  socket.on("message_deleted", ({ messageId }) => {
    pulseMessages = pulseMessages.filter((m) => m.id !== messageId);
    const el = document.getElementById(`msg-${messageId}`);
    if (el) el.remove();
  });

  socket.on("user_typing", ({ targetId, userName }) => {
    if (targetId === pulseCurrentTarget.id) {
      typingText.textContent = `${userName} is typing...`;
      typingIndicator.classList.remove("hidden");
    }
  });

  socket.on("user_stop_typing", ({ targetId }) => {
    if (targetId === pulseCurrentTarget.id) {
      typingIndicator.classList.add("hidden");
    }
  });
}

function joinPulseRoom() {
  if (!socket || !socket.connected) return;
  socket.emit("join_channel", { targetId: pulseCurrentTarget.id });
}

function leavePulseRoom(targetId) {
  if (!socket || !socket.connected) return;
  socket.emit("leave_channel", { targetId });
}

async function loadPulseChannels() {
  try {
    const data = await apiRequest("/chats/channels");
    pulseChannels = data.channels || [];
    renderPulseChannelsList();
  } catch (err) {
    console.error("Failed to load channels:", err);
  }
}

function renderPulseChannelsList() {
  channelsList.innerHTML = "";
  pulseChannels.forEach((ch) => {
    const li = document.createElement("li");
    li.className = `nav-item ${pulseCurrentTarget.type === "channel" && pulseCurrentTarget.id === ch.id ? "active" : ""}`;
    li.innerHTML = `
      <span class="nav-prefix">#</span>
      <span class="nav-label">${escapeHtml(ch.name)}</span>
    `;
    li.addEventListener("click", () => selectPulseChannel(ch));
    channelsList.appendChild(li);
  });
}

async function selectPulseChannel(channel) {
  if (pulseCurrentTarget.id === channel.id) return;
  leavePulseRoom(pulseCurrentTarget.id);
  pulseCurrentTarget = {
    type: "channel",
    id: channel.id,
    name: channel.name,
    desc: channel.description || `Discussion for #${channel.name}`,
  };
  updatePulseHeaderUI();
  renderPulseChannelsList();
  renderPulseDmList();
  joinPulseRoom();
  await loadPulseMessages();
  sidebar.classList.remove("mobile-open");
}

async function loadPulseDmUsers() {
  try {
    const data = await apiRequest("/chats/users");
    renderPulseDmList(data.users || []);
  } catch (err) {
    console.error("Failed to load users:", err);
  }
}

function renderPulseDmList(users = pulseOnlineUsers) {
  dmList.innerHTML = "";
  const otherUsers = (users || []).filter((u) => u.id !== currentUser.id);
  otherUsers.forEach((u) => {
    const dmKey = `dm:${[currentUser.id, u.id].sort().join(":")}`;
    const isActive = pulseCurrentTarget.type === "dm" && pulseCurrentTarget.id === dmKey;
    const li = document.createElement("li");
    li.className = `nav-item ${isActive ? "active" : ""}`;
    li.innerHTML = `
      <span class="nav-user-avatar">${u.avatar || "👤"}</span>
      <span class="nav-label">${escapeHtml(u.displayName)}</span>
      <span class="user-status-dot ${u.status === "online" ? "" : "offline"}"></span>
    `;
    li.addEventListener("click", () => selectPulseDirectMessage(u, dmKey));
    dmList.appendChild(li);
  });
}

async function selectPulseDirectMessage(user, dmKey) {
  if (pulseCurrentTarget.id === dmKey) return;
  leavePulseRoom(pulseCurrentTarget.id);
  pulseCurrentTarget = {
    type: "dm",
    id: dmKey,
    name: user.displayName,
    desc: `Direct conversation with ${user.displayName}`,
    user,
  };
  updatePulseHeaderUI();
  renderPulseChannelsList();
  renderPulseDmList();
  joinPulseRoom();
  await loadPulseMessages();
  sidebar.classList.remove("mobile-open");
}

function updatePulseHeaderUI() {
  targetSymbol.textContent = pulseCurrentTarget.type === "channel" ? "#" : "@";
  targetTitle.textContent = pulseCurrentTarget.name;
  targetDesc.textContent = pulseCurrentTarget.desc;
  panelTargetDesc.textContent = pulseCurrentTarget.desc;
  welcomeHeading.textContent = pulseCurrentTarget.type === "channel"
    ? `Welcome to #${pulseCurrentTarget.name}!`
    : `Chat with ${pulseCurrentTarget.name}`;
  welcomeSubtext.textContent = pulseCurrentTarget.type === "channel"
    ? `This is the start of the #${pulseCurrentTarget.name} channel.`
    : `Direct and private conversation with ${pulseCurrentTarget.name}.`;
  messageInput.placeholder = `Message ${pulseCurrentTarget.type === "channel" ? "#" + pulseCurrentTarget.name : pulseCurrentTarget.name}...`;
}

function renderPulseOnlineLists(onlineIds = []) {
  const count = onlineIds.length || 1;
  onlineCountLabel.textContent = `${count} online`;
  panelMemberCount.textContent = count;
  onlineMembersList.innerHTML = "";
  pulseOnlineUsers.forEach((u) => {
    const isOnline = onlineIds.includes(u.id);
    const li = document.createElement("li");
    li.className = "member-row";
    li.innerHTML = `
      <span class="member-avatar">${u.avatar || "👤"}</span>
      <span class="member-name">${escapeHtml(u.displayName)} ${u.id === currentUser.id ? "(You)" : ""}</span>
      <span class="user-status-dot ${isOnline ? "" : "offline"}"></span>
    `;
    onlineMembersList.appendChild(li);
  });
}

async function loadPulseMessages() {
  messagesStream.innerHTML = "";
  try {
    const endpoint = pulseCurrentTarget.type === "channel"
      ? `/chats/channels/${pulseCurrentTarget.id}/messages`
      : `/chats/conversations/${pulseCurrentTarget.id}/messages`;
    const data = await apiRequest(endpoint);
    pulseMessages = data.messages || [];
    pulseMessages.forEach((msg) => appendPulseMessageCard(msg));
    scrollPulseToBottom();
  } catch (err) {
    console.error("Failed to load messages:", err);
  }
}

function appendPulseMessageCard(msg) {
  const isMe = msg.senderId === currentUser.id;
  const isBot = msg.senderId.includes("bot");
  const card = document.createElement("div");
  card.className = `message-card ${isMe ? "mine" : ""}`;
  card.id = `msg-${msg.id}`;
  const timeFormatted = formatTime(msg.createdAt);

  card.innerHTML = `
    <div class="message-avatar">${msg.senderAvatar || "👤"}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${escapeHtml(msg.senderName)}</span>
        ${isMe ? '<span class="role-badge you">You</span>' : isBot ? '<span class="role-badge bot">Bot</span>' : ''}
        <span class="message-time">${timeFormatted}</span>
      </div>
      <div class="message-body">${formatMessageText(msg.text)}</div>
      ${msg.mediaUrl ? `<div class="message-image-wrap" data-img="${escapeHtml(msg.mediaUrl)}"><img src="${escapeHtml(msg.mediaUrl)}" class="message-image" loading="lazy" /></div>` : ''}
      <div class="reactions-tray" id="reactions-${msg.id}">${renderPulseReactionChips(msg.reactions || {}, msg.id)}</div>
    </div>
    <div class="message-actions-bar">
      <button type="button" class="action-chip-btn" data-action="react" data-emoji="👍">👍</button>
      <button type="button" class="action-chip-btn" data-action="react" data-emoji="❤️">❤️</button>
      <button type="button" class="action-chip-btn" data-action="react" data-emoji="😂">😂</button>
      <button type="button" class="action-chip-btn" data-action="react" data-emoji="🔥">🔥</button>
      <button type="button" class="action-chip-btn" data-action="react" data-emoji="🚀">🚀</button>
      ${isMe ? `<button type="button" class="action-chip-btn delete-btn" data-action="delete">🗑️</button>` : ''}
    </div>
  `;

  card.querySelectorAll(".action-chip-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.action === "react") togglePulseReaction(msg.id, btn.dataset.emoji);
      else if (btn.dataset.action === "delete") deletePulseMessage(msg.id);
    });
  });

  messagesStream.appendChild(card);
}

function renderPulseReactionChips(reactions, messageId) {
  return Object.entries(reactions)
    .filter(([_, users]) => users.length > 0)
    .map(([emoji, users]) => `
      <button type="button" class="reaction-chip ${users.includes(currentUser.id) ? "active" : ""}" data-emoji="${emoji}" data-msgid="${messageId}">
        <span>${emoji}</span>
        <span class="reaction-count">${users.length}</span>
      </button>
    `).join("");
}

function updatePulseMessageReactions(messageId, reactions) {
  const tray = document.getElementById(`reactions-${messageId}`);
  if (tray) tray.innerHTML = renderPulseReactionChips(reactions, messageId);
}

function togglePulseReaction(messageId, emoji) {
  if (socket && socket.connected) {
    socket.emit("toggle_reaction", { messageId, emoji, userId: currentUser.id, targetId: pulseCurrentTarget.id });
  } else {
    apiRequest(`/chats/messages/${messageId}/reaction`, { method: "POST", body: JSON.stringify({ emoji }) })
      .then((res) => { if (res.message) updatePulseMessageReactions(messageId, res.message.reactions); });
  }
}

function deletePulseMessage(messageId) {
  if (socket && socket.connected) {
    socket.emit("delete_message", { messageId, targetId: pulseCurrentTarget.id });
  } else {
    apiRequest(`/chats/messages/${messageId}`, { method: "DELETE" })
      .then(() => { const el = document.getElementById(`msg-${messageId}`); if (el) el.remove(); });
  }
}

function scrollPulseToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

composerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  const payload = {
    targetId: pulseCurrentTarget.id,
    text,
    senderId: currentUser.id,
    senderName: currentUser.displayName,
    senderAvatar: currentUser.avatar,
    mediaUrl: attachedMediaUrl || undefined,
  };

  messageInput.value = "";
  clearAttachedMedia();
  playSound("sent");

  if (socket && socket.connected) {
    socket.emit("send_message", payload);
  } else {
    const endpoint = pulseCurrentTarget.type === "channel"
      ? `/chats/channels/${pulseCurrentTarget.id}/messages`
      : `/chats/conversations/${pulseCurrentTarget.id}/messages`;
    const data = await apiRequest(endpoint, { method: "POST", body: JSON.stringify(payload) });
    if (data.message) {
      pulseMessages.push(data.message);
      appendPulseMessageCard(data.message);
      scrollPulseToBottom();
    }
  }
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composerForm.dispatchEvent(new Event("submit"));
  }
});

function clearAttachedMedia() {
  attachedMediaUrl = null;
  if (mediaUrlInput) mediaUrlInput.value = "";
  if (mediaPreviewChip) mediaPreviewChip.classList.add("hidden");
}

soundToggleBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundIcon.textContent = soundEnabled ? "🔊" : "🔇";
  soundLabel.textContent = soundEnabled ? "Sound On" : "Muted";
});

mobileMenuBtn.addEventListener("click", () => sidebar.classList.toggle("mobile-open"));
toggleMembersPanelBtn.addEventListener("click", () => rightPanel.classList.toggle("collapsed"));
closeRightPanelBtn.addEventListener("click", () => rightPanel.classList.add("collapsed"));
clearChatBtn.addEventListener("click", () => { messagesStream.innerHTML = ""; });

// Global helpers
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatMessageText(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/`([^`]+)`/g, "<code class='inline-code'>$1</code>");
  safe = safe.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" class="chat-link">$1</a>');
  return safe;
}

function formatTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ==========================================
// APPLICATION INITIALIZATION
// ==========================================
(async () => {
  initUser();
  initPulseSocket();
  // Set UI mode based on flag (default is WhatsApp UI)
  setUIMode(WHATSAPP_MODE);
})();

