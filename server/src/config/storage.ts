import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const DB_FILE = path.join(DATA_DIR, "chat_db.json");

export interface ChatUser {
  id: string;
  displayName: string;
  email?: string;
  avatar: string;
  status: "online" | "idle" | "offline";
  lastSeen: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  isDefault?: boolean;
}

export interface ChatMessage {
  id: string;
  targetId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  mediaUrl?: string;
  reactions: Record<string, string[]>;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  participants: string[];
  lastMessageAt: string;
}

interface DatabaseSchema {
  users: ChatUser[];
  channels: ChatChannel[];
  messages: ChatMessage[];
  conversations: ChatConversation[];
}

const DEFAULT_CHANNELS: ChatChannel[] = [
  {
    id: "general",
    name: "general",
    description: "Welcome to PulseChat! Open discussion for everyone.",
    createdAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: "tech-talk",
    name: "tech-talk",
    description: "Share code, discuss tech stacks, APIs, and frameworks.",
    createdAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: "random",
    name: "random",
    description: "Casual thoughts, memes, links, and fun off-topic chat.",
    createdAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: "announcements",
    name: "announcements",
    description: "Channel for announcements.",
    createdAt: new Date().toISOString(),
    isDefault: true,
  },
];

const DEFAULT_USERS: ChatUser[] = [
  {
    id: "bot-spark",
    displayName: "Spark AI",
    avatar: "🤖",
    status: "online",
    lastSeen: new Date().toISOString(),
  },
  {
    id: "user-sugan",
    displayName: "Sugan",
    avatar: "⚡",
    status: "online",
    lastSeen: new Date().toISOString(),
  },
  {
    id: "user-alex",
    displayName: "Alex Rivera",
    avatar: "🎨",
    status: "online",
    lastSeen: new Date().toISOString(),
  },
];

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: "msg-init-1",
    targetId: "general",
    senderId: "bot-spark",
    senderName: "Spark AI",
    senderAvatar: "🤖",
    text: "✨ Welcome to PulseChat! Real-time messaging is fully active and ready to go.",
    reactions: { "🔥": ["user-sugan"], "❤️": ["user-alex"] },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "msg-init-2",
    targetId: "general",
    senderId: "user-sugan",
    senderName: "Sugan",
    senderAvatar: "⚡",
    text: "Hey everyone! The authentication barrier is disabled so anyone can join and chat instantly! 🚀",
    reactions: { "🎉": ["bot-spark", "user-alex"] },
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "msg-init-3",
    targetId: "general",
    senderId: "user-alex",
    senderName: "Alex Rivera",
    senderAvatar: "🎨",
    text: "Looks amazing! Real-time typing indicators, emoji reactions, channels, and rich messages all work seamlessly! 🙌",
    reactions: { "👍": ["user-sugan"] },
    createdAt: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: "msg-init-4",
    targetId: "tech-talk",
    senderId: "user-sugan",
    senderName: "Sugan",
    senderAvatar: "⚡",
    text: "Node.js + Express + Socket.io is running like a charm. Ready to test live messaging!",
    reactions: { "💻": ["user-alex"] },
    createdAt: new Date(Date.now() - 1200000).toISOString(),
  },
];

class StorageManager {
  private data: DatabaseSchema;

  constructor() {
    this.data = {
      users: [...DEFAULT_USERS],
      channels: [...DEFAULT_CHANNELS],
      messages: [...DEFAULT_MESSAGES],
      conversations: [],
    };

    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;

        if (parsed.users && parsed.channels && parsed.messages) {
          this.data = {
            users: parsed.users,
            channels: parsed.channels,
            messages: parsed.messages,
            conversations: parsed.conversations ?? [],
          };

          console.log(
            `[Storage] Loaded ${this.data.messages.length} messages, ${this.data.channels.length} channels, ${this.data.users.length} users from local store.`
          );
          return;
        }
      }

      this.save();
    } catch (err) {
      console.error(
        "[Storage] Failed to load data from disk, using defaults:",
        err
      );
    }
  }

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("[Storage] Failed to save database to disk:", err);
    }
  }

  // Users
  getUsers(): ChatUser[] {
    return this.data.users;
  }

  getUserById(id: string): ChatUser | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  upsertUser(
    user: Partial<ChatUser> & { id: string; displayName: string }
  ): ChatUser {
    const existingIndex = this.data.users.findIndex((u) => u.id === user.id);

    const updated: ChatUser = {
      id: user.id,
      displayName: user.displayName.trim(),
      email: user.email ?? `${user.id}@pulsechat.local`,
      avatar: user.avatar || "👤",
      status: user.status || "online",
      lastSeen: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.data.users[existingIndex] = {
        ...this.data.users[existingIndex],
        ...updated,
      };
    } else {
      this.data.users.push(updated);
    }

    this.save();
    return updated;
  }

  setUserStatus(id: string, status: "online" | "idle" | "offline"): void {
    const user = this.getUserById(id);

    if (user) {
      user.status = status;
      user.lastSeen = new Date().toISOString();
      this.save();
    }
  }

  // Channels
  getChannels(): ChatChannel[] {
    return this.data.channels;
  }

  getChannelById(id: string): ChatChannel | undefined {
    return this.data.channels.find(
      (c) => c.id === id || c.name.toLowerCase() === id.toLowerCase()
    );
  }

  createChannel(name: string, description = ""): ChatChannel {
    const cleanId = name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/^-+|-+$/g, "");

    const existing = this.getChannelById(cleanId);
    if (existing) return existing;

    const channel: ChatChannel = {
      id: cleanId,
      name: cleanId,
      description: description.trim() || `Channel for #${cleanId}`,
      createdAt: new Date().toISOString(),
    };

    this.data.channels.push(channel);
    this.save();
    return channel;
  }

  // Messages
  getMessages(
    targetId: string,
    limit = 100,
    before?: string
  ): { messages: ChatMessage[]; hasMore: boolean } {
    let filtered = this.data.messages.filter((m) => m.targetId === targetId);

    if (before) {
      const beforeDate = new Date(before).getTime();
      filtered = filtered.filter(
        (m) => new Date(m.createdAt).getTime() < beforeDate
      );
    }

    filtered.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const hasMore = filtered.length > limit;
    const messages = filtered.slice(-limit);

    return { messages, hasMore };
  }

  addMessage(msg: {
    targetId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    text: string;
    mediaUrl?: string;
  }): ChatMessage {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      targetId: msg.targetId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      senderAvatar: msg.senderAvatar || "👤",
      text: msg.text.trim(),
      ...(msg.mediaUrl !== undefined ? { mediaUrl: msg.mediaUrl } : {}),
      reactions: {},
      createdAt: new Date().toISOString(),
    };

    this.data.messages.push(newMsg);

    if (this.data.messages.length > 2000) {
      this.data.messages = this.data.messages.slice(-2000);
    }

    this.save();
    return newMsg;
  }

  toggleReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): ChatMessage | null {
    const message = this.data.messages.find((m) => m.id === messageId);
    if (!message) return null;

    if (!message.reactions) {
      message.reactions = {};
    }

    if (!message.reactions[emoji]) {
      message.reactions[emoji] = [];
    }

    const index = message.reactions[emoji].indexOf(userId);

    if (index >= 0) {
      message.reactions[emoji].splice(index, 1);

      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji];
      }
    } else {
      message.reactions[emoji].push(userId);
    }

    this.save();
    return message;
  }

  deleteMessage(messageId: string): boolean {
    const initialLen = this.data.messages.length;

    this.data.messages = this.data.messages.filter(
      (m) => m.id !== messageId
    );

    if (this.data.messages.length !== initialLen) {
      this.save();
      return true;
    }

    return false;
  }

  // Direct Conversations
  getConversations(
    userId: string
  ): Array<{
    id: string;
    participant: ChatUser;
    lastMessage?: ChatMessage;
    lastMessageAt: string;
  }> {
    const directMessages = this.data.messages.filter((m) =>
      m.targetId.startsWith("dm:")
    );

    const participantsSet = new Set<string>();

    for (const msg of directMessages) {
      const parts = msg.targetId.replace("dm:", "").split(":");

      if (parts.includes(userId)) {
        const otherId = parts.find((p) => p !== userId);
        if (otherId) participantsSet.add(otherId);
      }
    }

    for (const u of this.data.users) {
      if (u.id !== userId) {
        participantsSet.add(u.id);
      }
    }

    const results: Array<{
      id: string;
      participant: ChatUser;
      lastMessage?: ChatMessage;
      lastMessageAt: string;
    }> = [];

    for (const otherId of participantsSet) {
      const otherUser = this.getUserById(otherId);
      if (!otherUser) continue;

      const dmKey = `dm:${[userId, otherId].sort().join(":")}`;
      const dmMessages = this.data.messages.filter(
        (m) => m.targetId === dmKey
      );
      const lastMsg = dmMessages[dmMessages.length - 1];

      results.push({
        id: dmKey,
        participant: otherUser,
        ...(lastMsg !== undefined ? { lastMessage: lastMsg } : {}),
        lastMessageAt: lastMsg?.createdAt || otherUser.lastSeen,
      });
    }

    results.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime()
    );

    return results;
  }
}

export const storage = new StorageManager();