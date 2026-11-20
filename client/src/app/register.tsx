import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Button, ErrorText, Field, Screen, Txt } from "../components/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export default function Register() {
  const { signIn } = useSession();
  const params = useLocalSearchParams<{ code?: string }>();
  const [inviteCode, setInviteCode] = useState(params.code ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const { token, user } = await api.register({ name, email: email.trim(), password, inviteCode: inviteCode.trim() });
      await signIn(token, user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Create account" back="Back">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 28, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Txt tone="muted" style={{ marginBottom: 8 }}>
            Enter the invite code you were sent.
          </Txt>
          <Field label="Invite code" value={inviteCode} onChangeText={setInviteCode} autoCapitalize="none" autoCorrect={false} />
          <Field label="Name" value={name} onChangeText={setName} autoComplete="name" />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="At least 8 characters"
            onSubmitEditing={submit}
          />
          <ErrorText message={error} />
          <View>
            <Button
              label="Create account"
              onPress={submit}
              loading={busy}
              disabled={!inviteCode || !name || !email || password.length < 8}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
