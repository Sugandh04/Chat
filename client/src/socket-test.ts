import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
    withCredentials: true,
    transports: ["websocket", "polling"],
});

const conversationId = "6ae730e571ab39ee7600786c";

const status = document.getElementById("status")!;
const messages = document.getElementById("messages")!;
const messageInput = document.getElementById("message") as HTMLInputElement;

socket.on("connect", () => {
    status.textContent = `Connected! Socket ID: ${socket.id}`;
    console.log("Socket connected:", socket.id);
});

socket.on("connect_error", (error) => {
    status.textContent = `Connection error: ${error.message}`;
    console.error("Socket connection error:", error);
});

socket.on("disconnect", (reason) => {
    status.textContent = `Disconnected: ${reason}`;
});

socket.on("conversation_joined", (data) => {
    console.log("Joined conversation:", data);
});

socket.on("new_message", (message) => {
    messages.textContent +=
        `\n${message.senderId}: ${message.text}`;
});

socket.on("socket_error", (error) => {
    console.error("Socket error:", error);
});

document.getElementById("join")!.addEventListener("click", () => {
    socket.emit("join_conversation", { conversationId });
});

document.getElementById("send")!.addEventListener("click", () => {
    const text = messageInput.value.trim();

    if (!text) return;

    socket.emit(
        "send_message",
        { conversationId, text },
        (result: {
            success: boolean;
            error?: string;
        }) => {
            console.log("Send result:", result);

            if (!result.success) {
                alert(result.error || "Message failed");
                return;
            }

            messageInput.value = "";
        }
    );
});