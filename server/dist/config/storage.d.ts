export interface ChatUser {
    id: string;
    displayName: string;
    email?: string;
    avatar: string;
    status: "online" | "idle" | "offline";
    lastSeen: string;
}
export interface ChatChannel {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    isDefault?: boolean;
}
export interface ChatMessage {
    id: string;
    targetId: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    text: string;
    mediaUrl?: string;
    reactions: Record<string, string[]>;
    createdAt: string;
}
export interface ChatConversation {
    id: string;
    participants: string[];
    lastMessageAt: string;
}
declare class StorageManager {
    private data;
    constructor();
    private load;
    private save;
    getUsers(): ChatUser[];
    getUserById(id: string): ChatUser | undefined;
    upsertUser(user: Partial<ChatUser> & {
        id: string;
        displayName: string;
    }): ChatUser;
    setUserStatus(id: string, status: "online" | "idle" | "offline"): void;
    getChannels(): ChatChannel[];
    getChannelById(id: string): ChatChannel | undefined;
    createChannel(name: string, description?: string): ChatChannel;
    getMessages(targetId: string, limit?: number, before?: string): {
        messages: ChatMessage[];
        hasMore: boolean;
    };
    addMessage(msg: {
        targetId: string;
        senderId: string;
        senderName: string;
        senderAvatar?: string;
        text: string;
        mediaUrl?: string;
    }): ChatMessage;
    toggleReaction(messageId: string, emoji: string, userId: string): ChatMessage | null;
    deleteMessage(messageId: string): boolean;
    getConversations(userId: string): Array<{
        id: string;
        participant: ChatUser;
        lastMessage?: ChatMessage;
        lastMessageAt: string;
    }>;
}
export declare const storage: StorageManager;
export {};
//# sourceMappingURL=storage.d.ts.map