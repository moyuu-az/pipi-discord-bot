interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface Conversation {
    username: string;
    messages: Message[];
}

export class ConversationHistory {
    private conversations: Map<string, Message[]>;
    private readonly maxMessages: number;

    constructor(maxMessages: number = 10) {
        this.conversations = new Map();
        this.maxMessages = maxMessages;
    }

    addMessage(username: string, role: 'user' | 'assistant', content: string): void {
        if (!this.conversations.has(username)) {
            this.conversations.set(username, []);
        }

        const messages = this.conversations.get(username)!;
        messages.push({ role, content });

        // 最大メッセージ数を超えたら古いメッセージを削除
        if (messages.length > this.maxMessages) {
            messages.shift();
        }
    }

    getConversation(username: string): Message[] {
        return this.conversations.get(username) || [];
    }

    clearConversation(username: string): void {
        this.conversations.delete(username);
    }
}
