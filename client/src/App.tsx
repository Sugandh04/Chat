import { useState, useEffect, useRef, useCallback } from 'react'
import { api, type User, type Conversation, type Message } from './api'
import { getSocket, connectSocket, disconnectSocket } from './socket'
import './App.css'
import Registration from './Registration'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long' })
}

function groupByDate(messages: Message[]) {
  const groups: { label: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const label = formatDate(msg.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.messages.push(msg)
    } else {
      groups.push({ label, messages: [msg] })
    }
  }
  return groups
}

// ─────────────────────────────────────────────────────────────────────────────
// Login page
// ─────────────────────────────────────────────────────────────────────────────

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user } = await api.login(email.trim(), password)
      onLogin(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-container">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <div className="brand-icon">C</div>
          <span>ChatApp</span>
        </div>

        <h1>Sign in</h1>
        <p className="auth-description">Welcome back — your conversations are waiting.</p>

        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="auth-footer">
          Need an account?&nbsp;
          <a href="/register" style={{ color: '#128c7e', fontWeight: 600 }}>
            Use your invitation link.
          </a>
        </p>
      </form>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// New-chat modal — pick a user to start a conversation with
// ─────────────────────────────────────────────────────────────────────────────

function NewChatModal({
  onClose,
  onStart,
}: {
  onClose: () => void
  onStart: (conv: Conversation) => void
}) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getUsers()
      .then((d) => setUsers(d.users))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const start = async (userId: string) => {
    try {
      const { conversation } = await api.createConversation(userId)
      onStart(conversation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation.')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>New conversation</h2>
          <button className="icon-button" onClick={onClose}>✕</button>
        </header>

        {loading && <p className="modal-hint">Loading users…</p>}
        {error && <p className="modal-error">{error}</p>}
        {!loading && users.length === 0 && (
          <p className="modal-hint">No other users found.</p>
        )}

        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id}>
              <button className="user-pick-btn" onClick={() => start(u.id)}>
                <div className="avatar small">{u.displayName[0].toUpperCase()}</div>
                <div>
                  <div className="user-pick-name">{u.displayName}</div>
                  <div className="user-pick-email">{u.email}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main chat view
// ─────────────────────────────────────────────────────────────────────────────

function ChatApp({ currentUser, onLogout }: { currentUser: User; onLogout: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [onlineIds, setOnlineIds] = useState<string[]>([])
  const [showNewChat, setShowNewChat] = useState(false)
  const [search, setSearch] = useState('')
  const [sendError, setSendError] = useState('')

  const messagesBottomRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousConvRef = useRef<string | null>(null)

  // ── Load conversations ──────────────────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    try {
      const { conversations: convs } = await api.getConversations()
      setConversations(convs)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  // ── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    connectSocket()
    const socket = getSocket()

    socket.on('presence_update', ({ onlineUserIds }: { onlineUserIds: string[] }) => {
      setOnlineIds(onlineUserIds)
    })

    socket.on('new_message', (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      // bump conversation's lastMessageAt in list
      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === msg.conversationId
              ? { ...c, lastMessageAt: msg.createdAt }
              : c
          )
          .sort(
            (a, b) =>
              new Date(b.lastMessageAt).getTime() -
              new Date(a.lastMessageAt).getTime()
          )
      )
      // scroll down
      setTimeout(() => messagesBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })

    socket.on('user_typing', ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => new Set([...prev, userId]))
    })

    socket.on('user_stop_typing', ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    })

    return () => {
      socket.off('presence_update')
      socket.off('new_message')
      socket.off('user_typing')
      socket.off('user_stop_typing')
      disconnectSocket()
    }
  }, [])

  // ── Switch conversation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConvId) return
    const socket = getSocket()

    // Leave previous room
    if (previousConvRef.current && previousConvRef.current !== activeConvId) {
      socket.emit('leave_conversation', { conversationId: previousConvRef.current })
    }
    previousConvRef.current = activeConvId

    // Join new room
    socket.emit('join_conversation', { conversationId: activeConvId })

    // Load messages
    setMessages([])
    setHasMore(false)
    setTypingUsers(new Set())
    setLoadingMsgs(true)

    api.getMessages(activeConvId)
      .then(({ messages: msgs, hasMore: more }) => {
        setMessages(msgs)
        setHasMore(more)
        setTimeout(() => messagesBottomRef.current?.scrollIntoView(), 0)
      })
      .catch(() => {})
      .finally(() => setLoadingMsgs(false))
  }, [activeConvId])

  // ── Load older messages ─────────────────────────────────────────────────────
  const loadMore = async () => {
    if (!activeConvId || messages.length === 0) return
    const oldest = messages[0].id
    setLoadingMsgs(true)
    try {
      const { messages: older, hasMore: more } = await api.getMessages(activeConvId, oldest)
      setMessages((prev) => [...older, ...prev])
      setHasMore(more)
    } finally {
      setLoadingMsgs(false)
    }
  }

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = () => {
    const text = messageText.trim()
    if (!text || !activeConvId) return
    setSendError('')

    const socket = getSocket()
    socket.emit(
      'send_message',
      { conversationId: activeConvId, text },
      (result: { success: boolean; error?: string }) => {
        if (!result.success) {
          setSendError(result.error ?? 'Failed to send message.')
        }
      }
    )

    // stop typing indicator
    socket.emit('typing_stop', { conversationId: activeConvId })
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    setMessageText('')
  }

  // ── Typing indicators ───────────────────────────────────────────────────────
  const handleInputChange = (value: string) => {
    setMessageText(value)
    if (!activeConvId) return
    const socket = getSocket()
    socket.emit('typing_start', { conversationId: activeConvId })
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      socket.emit('typing_stop', { conversationId: activeConvId })
    }, 2000)
  }

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await api.logout().catch(() => {})
    disconnectSocket()
    onLogout()
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const activeConv = conversations.find((c) => c.id === activeConvId)
  const otherUserId = activeConv?.participant?.id ?? ''
  const isOtherOnline = onlineIds.includes(otherUserId)
  const isTyping = typingUsers.size > 0

  const filtered = conversations.filter((c) =>
    c.participant?.displayName.toLowerCase().includes(search.toLowerCase())
  )
  const dateGroups = groupByDate(messages)

  return (
    <main className="chat-app">
      {/* ─── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className={`sidebar ${activeConvId !== null ? 'mobile-hidden' : ''}`}>
        <header className="sidebar-header">
          <div className="brand">
            <div className="brand-icon">C</div>
            <span>ChatApp</span>
          </div>
          <button className="icon-button" title="New chat" onClick={() => setShowNewChat(true)}>
            ✎
          </button>
        </header>

        <div className="sidebar-content">
          <div className="welcome">
            <h2>Messages</h2>
            <p>Your private conversations.</p>
          </div>

          <div className="search-box">
            <span>⌕</span>
            <input
              type="text"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="conversation-heading">
            <span>ALL CHATS</span>
            <span>{filtered.length}</span>
          </div>

          <div className="conversation-list">
            {filtered.map((conv) => {
              const initial = conv.participant?.displayName[0]?.toUpperCase() ?? '?'
              const online = conv.participant ? onlineIds.includes(conv.participant.id) : false
              return (
                <button
                  key={conv.id}
                  className={`conversation-item ${activeConvId === conv.id ? 'active' : ''}`}
                  onClick={() => setActiveConvId(conv.id)}
                >
                  <div className="avatar">
                    {initial}
                    {online && <span className="online-indicator" />}
                  </div>
                  <div className="conversation-info">
                    <div className="conversation-top">
                      <h3>{conv.participant?.displayName ?? 'Unknown'}</h3>
                      <span>{formatTime(conv.lastMessageAt)}</span>
                    </div>
                    <p>{conv.participant?.email ?? ''}</p>
                  </div>
                </button>
              )
            })}

            {filtered.length === 0 && (
              <div className="no-results">
                {conversations.length === 0
                  ? 'No conversations yet. Start one with ✎'
                  : 'No conversations found.'}
              </div>
            )}
          </div>
        </div>

        <footer className="sidebar-footer">
          <div className="profile-avatar">
            {currentUser.displayName[0].toUpperCase()}
          </div>
          <div className="profile-info">
            <h4>{currentUser.displayName}</h4>
            <p>{currentUser.email}</p>
          </div>
          <button className="icon-button" title="Sign out" onClick={handleLogout}>
            ⏻
          </button>
        </footer>
      </aside>

      {/* ─── Chat area ──────────────────────────────────────────────────────── */}
      <section className={`chat-section ${activeConvId === null ? 'mobile-hidden' : ''}`}>
        {activeConv ? (
          <>
            <header className="chat-header">
              <button
                className="back-button"
                onClick={() => setActiveConvId(null)}
                aria-label="Back"
              >
                ←
              </button>
              <div className="avatar">
                {activeConv.participant?.displayName[0]?.toUpperCase() ?? '?'}
                {isOtherOnline && <span className="online-indicator" />}
              </div>
              <div className="chat-user-info">
                <h3>{activeConv.participant?.displayName ?? 'Unknown'}</h3>
                <p>
                  {isTyping
                    ? 'typing…'
                    : isOtherOnline
                    ? 'online'
                    : 'offline'}
                </p>
              </div>
            </header>

            <div className="messages-area">
              {hasMore && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <button
                    className="load-more-btn"
                    onClick={loadMore}
                    disabled={loadingMsgs}
                  >
                    {loadingMsgs ? 'Loading…' : 'Load older messages'}
                  </button>
                </div>
              )}

              {dateGroups.map((group) => (
                <div key={group.label}>
                  <div className="date-divider">
                    <span>{group.label.toUpperCase()}</span>
                  </div>

                  {group.messages.map((msg) => {
                    const isMine = msg.sender?.id === currentUser.id
                    return (
                      <div
                        key={msg.id}
                        className={`message-row ${isMine ? 'sent' : 'received'}`}
                      >
                        <div className="message-bubble">
                          <p>{msg.text}</p>
                          <span className="message-time">
                            {formatTime(msg.createdAt)}
                            {isMine && <span> ✓✓</span>}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {messages.length === 0 && !loadingMsgs && (
                <div className="empty-messages">
                  <p>No messages yet. Say hello! 👋</p>
                </div>
              )}

              <div ref={messagesBottomRef} />
            </div>

            {sendError && (
              <div className="send-error">{sendError}</div>
            )}

            <form
              className="message-composer"
              onSubmit={(e) => {
                e.preventDefault()
                sendMessage()
              }}
            >
              <input
                type="text"
                placeholder="Type a message…"
                value={messageText}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                autoFocus
              />
              <button
                type="submit"
                className="send-button"
                disabled={!messageText.trim()}
              >
                ↑
              </button>
            </form>
          </>
        ) : (
          <div className="empty-chat">
            <div className="empty-chat-icon">C</div>
            <h2>Your private space.</h2>
            <p>Select a conversation to start messaging.</p>
            <span>Private conversations. Just between you and them.</span>
          </div>
        )}
      </section>

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onStart={(conv) => {
            setConversations((prev) => {
              if (prev.some((c) => c.id === conv.id)) return prev
              return [conv, ...prev]
            })
            setActiveConvId(conv.id)
            setShowNewChat(false)
          }}
        />
      )}
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root — handles routing and auth state
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const isRegisterPage = window.location.pathname === '/register'

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(!isRegisterPage)

  useEffect(() => {
    if (isRegisterPage) return
    api.me()
      .then(({ user }) => setCurrentUser(user))
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [isRegisterPage])

  if (isRegisterPage) {
    return (
      <Registration
        onSuccess={() => {
          window.history.replaceState({}, '', '/')
          window.location.reload()
        }}
      />
    )
  }

  if (checking) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8696a0',
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    )
  }

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />
  }

  return (
    <ChatApp
      currentUser={currentUser}
      onLogout={() => setCurrentUser(null)}
    />
  )
}

export default App
