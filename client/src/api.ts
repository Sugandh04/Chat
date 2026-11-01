import { API_URL } from './env';

export type User = {
  id: string;
  displayName: string;
  email: string;
};

export type Conversation = {
  id: string;
  participant: User | null;
  lastMessageAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  sender: { id: string; displayName: string } | null;
  text: string;
  createdAt: string;
};

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Request failed');
  return data as T;
}

// Auth
export const api = {
  me: () =>
    request<{ user: User }>('/api/auth/me'),

  login: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (displayName: string, email: string, password: string, token: string) =>
    request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ displayName, email, password, token }),
    }),

  logout: () =>
    request<{ message: string }>('/api/auth/logout', { method: 'POST' }),

  // Conversations
  getConversations: () =>
    request<{ conversations: Conversation[] }>('/api/chats/conversations'),

  createConversation: (participantId: string) =>
    request<{ conversation: Conversation }>('/api/chats/conversations', {
      method: 'POST',
      body: JSON.stringify({ participantId }),
    }),

  // Users (other than self)
  getUsers: () =>
    request<{ users: User[] }>('/api/chats/users'),

  // Messages
  getMessages: (conversationId: string, before?: string) => {
    const query = before ? `?before=${before}` : '';
    return request<{ messages: Message[]; hasMore: boolean }>(
      `/api/chats/conversations/${conversationId}/messages${query}`
    );
  },

  deleteMessage: (messageId: string) =>
    request<{ message: string }>(`/api/chats/messages/${messageId}`, {
      method: 'DELETE',
    }),
};

