import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { Button, Divider, ErrorText, Field, Screen, Txt } from "../components/ui";
import { Invite, api } from "../lib/api";
import { useSession } from "../lib/session";

const webBase = () => process.env.EXPO_PUBLIC_WEB_URL || (Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "");

export default function Settings() {
  const { user, setUser, signOut } = useSession();
  const [name, setName] = useState(user?.name ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [fresh, setFresh] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isAdmin) api.invites().then((r) => setInvites(r.invites)).catch(() => {});
  }, [isAdmin, fresh]);

  const saveName = async () => {
    setError("");
    try {
      setUser((await api.updateName(name)).user);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const invite = async () => {
    setError("");
    try {
      setFresh((await api.createInvite(inviteEmail.trim())).invite);
      setInviteEmail("");
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const link = fresh ? (webBase() ? `${webBase()}/register?code=${fresh.code}` : fresh.code) : "";

  return (
    <Screen title="Settings" back="Back">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 28 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 14 }}>
          <Txt size={13} tone="muted" weight="600">
            PROFILE
          </Txt>
          <Field label="Name" value={name} onChangeText={setName} />
          <View>
            <Txt size={13} tone="muted" weight="500">
              Email
            </Txt>
            <Txt style={{ marginTop: 4 }}>{user?.email}</Txt>
          </View>
          <Button
            label={saved ? "Saved" : "Save name"}
            variant="quiet"
            onPress={saveName}
            disabled={!name.trim() || name.trim() === user?.name}
            style={{ alignSelf: "flex-start" }}
          />
        </View>

        {isAdmin ? (
          <>
            <Divider />
            <View style={{ gap: 14 }}>
              <Txt size={13} tone="muted" weight="600">
                INVITES
              </Txt>
              <Field
                label="Restrict to email (optional)"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Button label="Create invite" onPress={invite} style={{ alignSelf: "flex-start" }} />
              {fresh ? (
                <View style={{ gap: 10 }}>
                  <Txt size={13} tone="muted">
                    Valid for 7 days. Share this with the person you are inviting.
                  </Txt>
                  <Txt selectable size={14} style={{ fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) }}>
                    {link}
                  </Txt>
                  <Button
                    label={copied ? "Copied" : "Copy"}
                    variant="quiet"
                    style={{ alignSelf: "flex-start" }}
                    onPress={async () => {
                      await Clipboard.setStringAsync(link);
                      setCopied(true);
                    }}
                  />
                </View>
              ) : null}
              {invites.length ? (
                <View style={{ gap: 8, marginTop: 6 }}>
                  {invites.slice(0, 8).map((i) => (
                    <View key={i.code} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Txt size={14} tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                        {i.email ?? `Invite ${i.code.slice(0, 6)}`}
                      </Txt>
                      <Txt size={14} tone="faint">
                        {i.used ? "Used" : i.expired ? "Expired" : "Pending"}
                      </Txt>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        <ErrorText message={error} />
        <Divider />
        <Button label="Sign out" variant="quiet" onPress={signOut} style={{ alignSelf: "flex-start" }} />
      </ScrollView>
    </Screen>
  );
}
