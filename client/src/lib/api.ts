import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const fallback = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || fallback).replace(/\/$/, "");

const KEY = "chat.token";
export const tokenStore = {
  async get(): Promise<string | null> {
    try {
      if (Platform.OS === "web") return localStorage.getItem(KEY);
      return await SecureStore.getItemAsync(KEY);
    } catch {
      return null;
    }
  },
  async set(token: string | null) {
    try {
      if (Platform.OS === "web") {
        if (token) localStorage.setItem(KEY, token);
        else localStorage.removeItem(KEY);
      } else if (token) await SecureStore.setItemAsync(KEY, token);
      else await SecureStore.deleteItemAsync(KEY);
    } catch {}
  },
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
}
export interface Chat {
  id: string;
  type: "direct" | "group";
  title: string;
  members: { id: string; name: string }[];
  lastMessage: { text: string; sender: string; createdAt: string } | null;
  lastMessageAt: string;
}
export interface Message {
  id: string;
  chatId: string;
  sender: string;
  text: string;
  createdAt: string;
  pending?: boolean;
  failed?: boolean;
}
export interface Invite {
  code: string;
  email: string | null;
  used?: boolean;
  expired?: boolean;
  expiresAt: string;
}

let currentToken: string | null = null;
export const setApiToken = (t: string | null) => {
  currentToken = t;
};
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && currentToken) onUnauthorized();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", { method: "POST", body: { email, password } }),
  register: (b: { name: string; email: string; password: string; inviteCode: string }) =>
    request<{ token: string; user: User }>("/auth/register", { method: "POST", body: b }),
  me: () => request<{ user: User }>("/me"),
  updateName: (name: string) => request<{ user: User }>("/me", { method: "PATCH", body: { name } }),
  users: () => request<{ users: User[] }>("/users"),
  chats: () => request<{ chats: Chat[] }>("/chats"),
  createChat: (b: { type: "direct" | "group"; memberIds: string[]; name?: string }) =>
    request<{ chat: Chat }>("/chats", { method: "POST", body: b }),
  messages: (id: string, before?: string) =>
    request<{ messages: Message[] }>(`/chats/${id}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`),
  send: (id: string, text: string) =>
    request<{ message: Message }>(`/chats/${id}/messages`, { method: "POST", body: { text } }),
  invites: () => request<{ invites: Invite[] }>("/invites"),
  createInvite: (email: string) => request<{ invite: Invite }>("/invites", { method: "POST", body: { email } }),
};
