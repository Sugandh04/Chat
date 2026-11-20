import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Avatar, Button, Divider, Screen, Txt, formatTime } from "../components/ui";
import { Chat, api } from "../lib/api";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/theme";

export default function Chats() {
  const { user, subscribe, onChatsChanged } = useSession();
  const t = useTheme();
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setChats((await api.chats()).chats);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );
  useEffect(() => subscribe(() => void load()), [subscribe, load]);
  useEffect(() => onChatsChanged(() => void load()), [onChatsChanged, load]);

  const open = (c: Chat) => router.push({ pathname: "/chat/[id]", params: { id: c.id, title: c.title } });

  return (
    <Screen
      title="Messages"
      right={
        <View style={{ flexDirection: "row", gap: 20 }}>
          <Pressable onPress={() => router.push("/new")} hitSlop={8}>
            <Txt size={15} weight="500">
              New
            </Txt>
          </Pressable>
          <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
            <Txt size={15} tone="muted">
              Settings
            </Txt>
          </Pressable>
        </View>
      }
    >
      {chats && chats.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 }}>
          <Txt size={18} weight="500">
            No conversations yet
          </Txt>
          <Txt tone="muted" style={{ textAlign: "center" }}>
            Start a conversation with someone you have invited.
          </Txt>
          <Button label="New conversation" onPress={() => router.push("/new")} style={{ marginTop: 6 }} />
        </View>
      ) : (
        <FlatList
          data={chats ?? []}
          keyExtractor={(c) => c.id}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.muted} onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }} />}
          ItemSeparatorComponent={() => (
            <View style={{ paddingLeft: 76 }}>
              <Divider />
            </View>
          )}
          ListHeaderComponent={error ? <Txt tone="danger" size={14} style={{ padding: 20 }}>{error}</Txt> : undefined}
          renderItem={({ item }) => {
            const mine = item.lastMessage?.sender === user?.id;
            return (
              <Pressable
                onPress={() => open(item)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  gap: 14,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  alignItems: "center",
                  backgroundColor: pressed ? t.recvBg : "transparent",
                })}
              >
                <Avatar name={item.title} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <Txt weight="600" numberOfLines={1} style={{ flex: 1 }}>
                      {item.title}
                    </Txt>
                    {item.lastMessage ? (
                      <Txt size={12} tone="faint">
                        {formatTime(item.lastMessage.createdAt)}
                      </Txt>
                    ) : null}
                  </View>
                  <Txt size={14} tone="muted" numberOfLines={1}>
                    {item.lastMessage ? `${mine ? "You: " : ""}${item.lastMessage.text}` : "No messages yet"}
                  </Txt>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
