import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL, Message, User, api, setApiToken, setUnauthorizedHandler, tokenStore } from "./api";

type Listener = (m: Message) => void;

interface Session {
  ready: boolean;
  user: User | null;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: User) => void;
  subscribe: (fn: Listener) => () => void;
  onChatsChanged: (fn: () => void) => () => void;
}

const Ctx = createContext<Session | null>(null);
export const useSession = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("SessionProvider missing");
  return v;
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const messageListeners = useRef(new Set<Listener>());
  const chatListeners = useRef(new Set<() => void>());
  const socketRef = useRef<Socket | null>(null);

  const signOut = useCallback(async () => {
    setApiToken(null);
    await tokenStore.set(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    (async () => {
      const saved = await tokenStore.get();
      if (saved) {
        setApiToken(saved);
        try {
          const { user } = await api.me();
          setToken(saved);
          setUser(user);
        } catch {
          // A network failure keeps the token for next launch; a 401 already signed out.
        }
      }
      setReady(true);
    })();
  }, [signOut]);

  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("message", (m: Message) => messageListeners.current.forEach((fn) => fn(m)));
    socket.on("chat", () => chatListeners.current.forEach((fn) => fn()));
    socket.on("connect", () => chatListeners.current.forEach((fn) => fn()));
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const value = useMemo<Session>(
    () => ({
      ready,
      user,
      setUser,
      signOut,
      signIn: async (t, u) => {
        setApiToken(t);
        await tokenStore.set(t);
        setToken(t);
        setUser(u);
      },
      subscribe: (fn) => {
        messageListeners.current.add(fn);
        return () => void messageListeners.current.delete(fn);
      },
      onChatsChanged: (fn) => {
        chatListeners.current.add(fn);
        return () => void chatListeners.current.delete(fn);
      },
    }),
    [ready, user, signOut]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
