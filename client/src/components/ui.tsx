import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  StyleProp,
  StyleSheet,
  Text as RNText,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { FRAME_WIDTH, useTheme } from "../lib/theme";

export function Screen({
  children,
  title,
  back,
  right,
}: {
  children: React.ReactNode;
  title?: string;
  back?: string;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flex: 1, width: "100%", maxWidth: FRAME_WIDTH, alignSelf: "center" }}>
        {title !== undefined || back ? (
          <View
            style={{
              height: 56,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              gap: 16,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: t.line,
            }}
          >
            {back ? (
              <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={10}>
                <RNText style={{ color: t.muted, fontSize: 15 }}>{back}</RNText>
              </Pressable>
            ) : null}
            <RNText numberOfLines={1} style={{ flex: 1, color: t.ink, fontSize: 18, fontWeight: "600" }}>
              {title}
            </RNText>
            {right}
          </View>
        ) : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

/** Keeps content above the on-screen keyboard on every platform (Android is edge-to-edge). */
export function KeyboardView({ children, hasHeader = true }: { children: React.ReactNode; hasHeader?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={insets.top + (hasHeader ? 56 : 0)}
      style={{ flex: 1 }}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export function Txt({
  children,
  style,
  tone = "ink",
  size = 16,
  weight = "400",
  numberOfLines,
  selectable,
}: {
  selectable?: boolean;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  tone?: "ink" | "muted" | "faint" | "danger";
  size?: number;
  weight?: TextStyle["fontWeight"];
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <RNText selectable={selectable} numberOfLines={numberOfLines} style={[{ color: t[tone], fontSize: size, fontWeight: weight }, style]}>
      {children}
    </RNText>
  );
}

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = "solid",
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "solid" | "quiet";
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const solid = variant === "solid";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height: 48,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
          backgroundColor: solid ? t.sentBg : "transparent",
          borderWidth: solid ? 0 : StyleSheet.hairlineWidth,
          borderColor: t.line,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={solid ? t.sentInk : t.ink} />
      ) : (
        <RNText style={{ color: solid ? t.sentInk : t.ink, fontSize: 15, fontWeight: "500" }}>{label}</RNText>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Txt size={13} tone="muted" weight="500">
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={t.faint}
        {...props}
        style={[
          {
            height: 48,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: t.line,
            backgroundColor: t.surface,
            color: t.ink,
            paddingHorizontal: 14,
            fontSize: 16,
            outlineStyle: "none" as never,
          },
          props.style,
        ]}
      />
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.line }} />;
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const t = useTheme();
  const initial = (name.trim()[0] || "?").toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.recvBg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <RNText style={{ color: t.ink, fontSize: size * 0.4, fontWeight: "500" }}>{initial}</RNText>
    </View>
  );
}

export function ErrorText({ message }: { message: string }) {
  return message ? (
    <Txt tone="danger" size={14}>
      {message}
    </Txt>
  ) : null;
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}
