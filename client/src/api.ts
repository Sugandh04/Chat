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
  const url = `${API_URL}${path}`;
  let res: Response;

  try {
    res = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
  } catch (err: unknown) {
    console.error(`[API] Failed to fetch ${url}:`, err);
    throw new Error(
      'Unable to reach backend server. If Render is sleeping, it may take 30–50 seconds to wake up. Please try again.'
    );
  }

  let data: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new Error(data?.message ?? `Request failed with status ${res.status}`);
  }

  return (data ?? {}) as T;
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

  sendMessage: (conversationId: string, text: string) =>
    request<{ message: Message }>(
      `/api/chats/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      }
    ),

  deleteMessage: (messageId: string) =>
    request<{ message: string }>(`/api/chats/messages/${messageId}`, {
      method: 'DELETE',
    }),
};
