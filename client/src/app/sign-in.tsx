import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Button, ErrorText, Field, Screen, Txt } from "../components/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export default function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const { token, user } = await api.login(email.trim(), password);
      await signIn(token, user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 28 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6, marginBottom: 36 }}>
            <Txt size={30} weight="600">
              Sign in
            </Txt>
            <Txt tone="muted">Private messaging, by invitation only.</Txt>
          </View>
          <View style={{ gap: 16 }}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={submit}
            />
            <ErrorText message={error} />
            <Button label="Sign in" onPress={submit} loading={busy} disabled={!email || !password} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 28 }}>
            <Txt tone="muted" size={14}>
              Have an invite code?
            </Txt>
            <Link href="/register">
              <Txt size={14} weight="600">
                Create account
              </Txt>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
