// One-to-one voice and video calls in the browser (WebRTC). The server only relays signalling.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Avatar, Txt } from "../components/ui";
import { api } from "./api";
import { CallSignal, useSession } from "./session";
import { useTheme } from "./theme";

export interface Calls {
  supported: boolean;
  busy: boolean;
  start: (chatId: string, peerId: string, peerName: string, video: boolean) => void;
}

type Phase = "idle" | "calling" | "incoming" | "connecting" | "connected";

interface CallState {
  phase: Phase;
  chatId: string;
  peerId: string;
  peerName: string;
  callId: string;
  video: boolean;
  muted: boolean;
  camOff: boolean;
  note: string; // shown after a call ends or fails
}

const IDLE: CallState = { phase: "idle", chatId: "", peerId: "", peerName: "", callId: "", video: false, muted: false, camOff: false, note: "" };
const RING_TIMEOUT_MS = 45_000;
const FALLBACK_ICE: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302"] }];

const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== "undefined";

const Ctx = createContext<{ calls: Calls; state: CallState; actions: Actions; local: MediaStream | null; remote: MediaStream | null } | null>(null);

interface Actions {
  accept: () => void;
  decline: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

export const useCalls = (): Calls => {
  const v = useContext(Ctx);
  return v ? v.calls : { supported: false, busy: false, start: () => {} };
};

const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, sendCall, onCall } = useSession();
  const [state, setState] = useState<CallState>(IDLE);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (patch: Partial<CallState>) => {
    stateRef.current = { ...stateRef.current, ...patch };
    setState(stateRef.current);
  };

  const cleanup = useCallback((note = "") => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    pendingIce.current = [];
    setLocal(null);
    setRemote(null);
    stateRef.current = { ...IDLE, note };
    setState(stateRef.current);
    if (note) setTimeout(() => stateRef.current.phase === "idle" && stateRef.current.note === note && setState({ ...IDLE }), 3500);
  }, []);

  const signal = useCallback(
    (type: CallSignal["type"], data?: unknown) => {
      const s = stateRef.current;
      sendCall({ type, chatId: s.chatId, to: s.peerId, callId: s.callId, video: s.video, data });
    },
    [sendCall]
  );

  const openMedia = async (video: boolean) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: video ? { facingMode: "user" } : false,
    });
    localRef.current = stream;
    setLocal(stream);
    return stream;
  };

  const createPeer = async () => {
    let iceServers = FALLBACK_ICE;
    try {
      iceServers = (await api.ice()).iceServers as RTCIceServer[];
    } catch {}
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;
    localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));
    pc.onicecandidate = (e) => e.candidate && signal("ice", e.candidate.toJSON());
    pc.ontrack = (e) => setRemote(e.streams[0] ?? new MediaStream([e.track]));
    const giveUp = () => {
      signal("end");
      cleanup("Could not connect. These networks may need a relay server.");
    };
    // Don't hang on "Connecting" forever.
    const connectTimer = setTimeout(() => stateRef.current.phase === "connecting" && giveUp(), 20_000);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        clearTimeout(connectTimer);
        update({ phase: "connected" });
      } else if (pc.connectionState === "failed") {
        clearTimeout(connectTimer);
        if (stateRef.current.phase === "connected") {
          signal("end");
          cleanup("Connection lost.");
        } else giveUp();
      }
    };
    return pc;
  };

  const flushIce = async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    for (const c of pendingIce.current.splice(0)) await pc.addIceCandidate(c).catch(() => {});
  };

  const mediaError = (e: unknown) =>
    (e as Error)?.name === "NotAllowedError" ? "Allow microphone and camera access to make calls." : "Could not access the microphone or camera.";

  const start: Calls["start"] = (chatId, peerId, peerName, video) => {
    if (!supported || !user || stateRef.current.phase !== "idle") return;
    const callId = newId();
    update({ ...IDLE, phase: "calling", chatId, peerId, peerName, callId, video });
    openMedia(video)
      .then(() => {
        sendCall({ type: "invite", chatId, to: peerId, callId, video, data: { name: user.name } });
        timer.current = setTimeout(() => {
          if (stateRef.current.phase === "calling") {
            signal("end");
            cleanup("No answer.");
          }
        }, RING_TIMEOUT_MS);
      })
      .catch((e) => cleanup(mediaError(e)));
  };

  const accept = () => {
    const s = stateRef.current;
    if (s.phase !== "incoming") return;
    update({ phase: "connecting" });
    openMedia(s.video)
      .then(() => signal("accept"))
      .catch((e) => {
        signal("decline");
        cleanup(mediaError(e));
      });
  };

  const decline = () => {
    signal("decline");
    cleanup();
  };

  const hangUp = () => {
    signal("end");
    cleanup();
  };

  const toggleMute = () => {
    const muted = !stateRef.current.muted;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    update({ muted });
  };

  const toggleCamera = () => {
    const camOff = !stateRef.current.camOff;
    localRef.current?.getVideoTracks().forEach((t) => (t.enabled = !camOff));
    update({ camOff });
  };

  useEffect(
    () =>
      onCall(async (p) => {
        const s = stateRef.current;
        if (p.type === "invite") {
          if (!supported) return;
          if (s.phase !== "idle") {
            sendCall({ type: "decline", chatId: p.chatId, to: p.from, callId: p.callId });
            return;
          }
          const name = (p.data as { name?: string } | null)?.name || "Someone";
          update({ ...IDLE, phase: "incoming", chatId: p.chatId, peerId: p.from || "", peerName: name, callId: p.callId, video: !!p.video });
          return;
        }
        if (p.callId !== s.callId || p.from !== s.peerId || s.phase === "idle") return;
        try {
          switch (p.type) {
            case "accept": {
              if (s.phase !== "calling") return;
              if (timer.current) clearTimeout(timer.current);
              update({ phase: "connecting" });
              const pc = await createPeer();
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              signal("offer", pc.localDescription?.toJSON());
              break;
            }
            case "offer": {
              const pc = await createPeer();
              await pc.setRemoteDescription(p.data as RTCSessionDescriptionInit);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              signal("answer", pc.localDescription?.toJSON());
              await flushIce();
              break;
            }
            case "answer":
              await pcRef.current?.setRemoteDescription(p.data as RTCSessionDescriptionInit);
              await flushIce();
              break;
            case "ice":
              if (pcRef.current?.remoteDescription) await pcRef.current.addIceCandidate(p.data as RTCIceCandidateInit).catch(() => {});
              else pendingIce.current.push(p.data as RTCIceCandidateInit);
              break;
            case "decline":
              cleanup(`${s.peerName} declined.`);
              break;
            case "end":
              cleanup(s.phase === "incoming" ? "Missed call." : "Call ended.");
              break;
          }
        } catch {
          signal("end");
          cleanup("The call could not be connected.");
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onCall, sendCall, cleanup]
  );

  // Leaving the page ends the call.
  useEffect(() => {
    const leave = () => stateRef.current.phase !== "idle" && signal("end");
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [signal]);

  const value = useMemo(
    () => ({
      calls: { supported, busy: state.phase !== "idle", start },
      state,
      actions: { accept, decline, hangUp, toggleMute, toggleCamera },
      local,
      remote,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, local, remote, user]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function MediaView({ stream, muted, style }: { stream: MediaStream | null; muted?: boolean; style: React.CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return React.createElement("video", { ref, autoPlay: true, playsInline: true, muted, style });
}

function Round({ label, onPress, danger, active }: { label: string; onPress: () => void; danger?: boolean; active?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minWidth: 92,
        height: 48,
        paddingHorizontal: 22,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: danger ? t.danger : active ? "#FFFFFF" : "rgba(255,255,255,0.14)",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Txt size={15} weight="500" style={{ color: active ? "#18181B" : "#FFFFFF" }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function CallOverlay() {
  const v = useContext(Ctx);
  if (!v) return null;
  const { state: s, actions, local, remote } = v;

  if (s.phase === "idle") {
    return s.note ? (
      <View pointerEvents="none" style={{ position: "absolute", top: 20, left: 0, right: 0, alignItems: "center", zIndex: 100 }}>
        <View style={{ backgroundColor: "#27272A", paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 }}>
          <Txt size={14} style={{ color: "#FAFAF9" }}>
            {s.note}
          </Txt>
        </View>
      </View>
    ) : null;
  }

  const status =
    s.phase === "calling" ? "Calling..." : s.phase === "incoming" ? `Incoming ${s.video ? "video" : "voice"} call` : s.phase === "connecting" ? "Connecting..." : "";
  const showRemoteVideo = s.video && s.phase === "connected" && remote;

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: "#18181B" }}>
      {/* Remote audio always plays; remote video fills the screen when present. */}
      <MediaView
        stream={remote}
        style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", opacity: showRemoteVideo ? 1 : 0 }}
      />
      {!showRemoteVideo ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
          <Avatar name={s.peerName} size={96} />
          <Txt size={24} weight="600" style={{ color: "#FAFAF9" }}>
            {s.peerName}
          </Txt>
          {status ? (
            <Txt size={15} style={{ color: "#A1A1AA" }}>
              {status}
            </Txt>
          ) : (
            <Txt size={15} style={{ color: "#A1A1AA" }}>
              {s.video ? "Video call" : "Voice call"}
            </Txt>
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {s.video && local && s.phase !== "incoming" ? (
        <View style={{ position: "absolute", right: 16, top: 16, width: 120, height: 160, borderRadius: 12, overflow: "hidden", backgroundColor: "#27272A" }}>
          <MediaView stream={local} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", opacity: s.camOff ? 0 : 1 }} />
        </View>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, padding: 28, flexWrap: "wrap" }}>
        {s.phase === "incoming" ? (
          <>
            <Round label="Decline" danger onPress={actions.decline} />
            <Round label="Accept" active onPress={actions.accept} />
          </>
        ) : (
          <>
            <Round label={s.muted ? "Unmute" : "Mute"} active={s.muted} onPress={actions.toggleMute} />
            {s.video ? <Round label={s.camOff ? "Camera on" : "Camera off"} active={s.camOff} onPress={actions.toggleCamera} /> : null}
            <Round label={s.phase === "calling" ? "Cancel" : "End"} danger onPress={actions.hangUp} />
          </>
        )}
      </View>
    </View>
  );
}
