import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Avatar, Button, Divider, ErrorText, Field, Screen, Txt } from "../components/ui";
import { User, api } from "../lib/api";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/theme";

export default function NewChat() {
  const { user } = useSession();
  const t = useTheme();
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .users()
      .then((r) => setUsers(r.users.filter((u) => u.id !== user?.id)))
      .catch((e) => setError(e.message));
  }, [user?.id]);

  const create = async (memberIds: string[]) => {
    setBusy(true);
    setError("");
    try {
      const { chat } = await api.createChat({ type: mode, memberIds, name: mode === "group" ? name : undefined });
      router.replace({ pathname: "/chat/[id]", params: { id: chat.id, title: chat.title } });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    if (mode === "direct") return void create([id]);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <Screen title="New conversation" back="Close">
      <View style={{ flexDirection: "row", gap: 8, padding: 20, paddingBottom: 12 }}>
        {(["direct", "group"] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => {
              setMode(m);
              setSelected([]);
            }}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: mode === m ? t.sentBg : t.recvBg,
            }}
          >
            <Txt size={14} weight="500" style={{ color: mode === m ? t.sentInk : t.ink }}>
              {m === "direct" ? "Direct" : "Group"}
            </Txt>
          </Pressable>
        ))}
      </View>
      {mode === "group" ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <Field label="Group name" value={name} onChangeText={setName} />
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <ErrorText message={error} />
      </View>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        ItemSeparatorComponent={() => (
          <View style={{ paddingLeft: 76 }}>
            <Divider />
          </View>
        )}
        ListEmptyComponent={
          <Txt tone="muted" style={{ padding: 20 }}>
            No one else has joined yet. Invite someone from Settings.
          </Txt>
        }
        renderItem={({ item }) => {
          const on = selected.includes(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              disabled={busy}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingHorizontal: 20,
                paddingVertical: 12,
                backgroundColor: pressed ? t.recvBg : "transparent",
              })}
            >
              <Avatar name={item.name} size={40} />
              <View style={{ flex: 1 }}>
                <Txt weight="500">{item.name}</Txt>
                <Txt size={13} tone="muted">
                  {item.email}
                </Txt>
              </View>
              {mode === "group" ? (
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: on ? t.sentBg : t.faint,
                    backgroundColor: on ? t.sentBg : "transparent",
                  }}
                />
              ) : null}
            </Pressable>
          );
        }}
      />
      {mode === "group" ? (
        <View style={{ padding: 20 }}>
          <Button
            label={selected.length ? `Create group (${selected.length + 1})` : "Create group"}
            onPress={() => create(selected)}
            loading={busy}
            disabled={!name.trim() || selected.length < 1}
          />
        </View>
      ) : null}
    </Screen>
  );
}
