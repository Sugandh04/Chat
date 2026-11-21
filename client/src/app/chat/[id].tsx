import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, TextInput, View } from "react-native";
import { Screen, Txt, formatTime, KeyboardView } from "../../components/ui";
import { Chat, Message, api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { useTheme } from "../../lib/theme";

export default function ChatScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { user, subscribe, onChatsChanged } = useSession();
  const t = useTheme();
  const [messages, setMessages] = useState<Message[]>([]); // newest first
  const [names, setNames] = useState<Record<string, string>>({});
  const [isGroup, setIsGroup] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const loadingMore = useRef(false);

  const load = useCallback(async () => {
    try {
      const { messages } = await api.messages(id);
      setMessages((prev) => {
        const known = new Set(messages.map((m) => m.id));
        return [...prev.filter((m) => m.pending && !known.has(m.id)), ...messages];
      });
      setDone(messages.length < 50);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
    api
      .chats()
      .then(({ chats }) => {
        const c = chats.find((x: Chat) => x.id === id);
        if (!c) return;
        setIsGroup(c.type === "group");
        setNames(Object.fromEntries(c.members.map((m) => [m.id, m.name])));
      })
      .catch(() => {});
  }, [id, load]);

  useEffect(
    () =>
      subscribe((m) => {
        if (m.chatId !== id) return;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
      }),
    [subscribe, id]
  );
  // Reconnects may have missed messages.
  useEffect(() => onChatsChanged(() => void load()), [onChatsChanged, load]);

  const loadMore = async () => {
    const oldest = messages[messages.length - 1];
    if (done || loadingMore.current || !oldest || oldest.pending) return;
    loadingMore.current = true;
    try {
      const { messages: older } = await api.messages(id, oldest.createdAt);
      setMessages((prev) => [...prev, ...older.filter((o) => !prev.some((p) => p.id === o.id))]);
      setDone(older.length < 50);
    } catch {}
    loadingMore.current = false;
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !user) return;
    setText("");
    const tempId = `tmp-${Date.now()}`;
    const temp: Message = { id: tempId, chatId: id, sender: user.id, text: body, createdAt: new Date().toISOString(), pending: true };
    setMessages((prev) => [temp, ...prev]);
    try {
      const { message } = await api.send(id, body);
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== tempId);
        return without.some((m) => m.id === message.id) ? without : [message, ...without];
      });
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
    }
  };

  const retry = (m: Message) => {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    setText(m.text);
  };

  const rows = useMemo(
    () =>
      messages.map((m, i) => {
        const older = messages[i + 1];
        return { m, showName: isGroup && m.sender !== user?.id && older?.sender !== m.sender, gap: older?.sender === m.sender ? 3 : 12 };
      }),
    [messages, isGroup, user?.id]
  );

  return (
    <Screen title={title ?? ""} back="Back">
      <KeyboardView hasHeader={true}>
        <FlatList
          inverted
          data={rows}
          keyExtractor={(r) => r.m.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={error ? <Txt tone="danger" size={14} style={{ textAlign: "center", padding: 12 }}>{error}</Txt> : undefined}
          renderItem={({ item: { m, showName, gap } }) => {
            const mine = m.sender === user?.id;
            return (
              <View style={{ marginTop: gap, alignItems: mine ? "flex-end" : "flex-start" }}>
                {showName ? (
                  <Txt size={12} tone="muted" style={{ marginBottom: 3, marginLeft: 4 }}>
                    {names[m.sender] ?? "Member"}
                  </Txt>
                ) : null}
                <Pressable
                  disabled={!m.failed}
                  onPress={() => retry(m)}
                  style={{
                    maxWidth: "80%",
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 18,
                    borderBottomRightRadius: mine ? 5 : 18,
                    borderBottomLeftRadius: mine ? 18 : 5,
                    backgroundColor: mine ? t.sentBg : t.recvBg,
                    opacity: m.pending ? 0.6 : 1,
                  }}
                >
                  <Txt style={{ color: mine ? t.sentInk : t.recvInk, lineHeight: 22 }}>{m.text}</Txt>
                </Pressable>
                <Txt size={11} tone={m.failed ? "danger" : "faint"} style={{ marginTop: 3, marginHorizontal: 4 }}>
                  {m.failed ? "Not sent. Tap to edit and retry." : m.pending ? "Sending" : formatTime(m.createdAt)}
                </Txt>
              </View>
            );
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: t.line,
            backgroundColor: t.bg,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={t.faint}
            multiline
            maxLength={4000}
            onKeyPress={(e) => {
              const ev = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
              if (Platform.OS === "web" && ev.key === "Enter" && !ev.shiftKey) {
                (e as unknown as { preventDefault: () => void }).preventDefault();
                void send();
              }
            }}
            style={{
              flex: 1,
              maxHeight: 120,
              minHeight: 44,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: t.line,
              backgroundColor: t.surface,
              color: t.ink,
              paddingHorizontal: 16,
              paddingTop: 11,
              paddingBottom: 11,
              fontSize: 16,
              outlineStyle: "none" as never,
            }}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim()}
            style={{
              height: 44,
              paddingHorizontal: 18,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.sentBg,
              opacity: text.trim() ? 1 : 0.35,
            }}
          >
            <Txt size={15} weight="500" style={{ color: t.sentInk }}>
              Send
            </Txt>
          </Pressable>
        </View>
      </KeyboardView>
    </Screen>
  );
}
