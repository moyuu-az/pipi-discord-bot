import { GoogleGenerativeAI } from '@google/generative-ai';
import { BOT_CONFIG } from '../config/constants';
import { logger } from '../utils/logger';
import { ConversationHistory } from './conversation-history';

export class GeminiChat {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private history: ConversationHistory;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: BOT_CONFIG.MODEL_NAME,
        });
        this.history = new ConversationHistory(10);
        logger.info('GeminiChat initialized successfully');
    }

    async getResponse(text: string, username: string): Promise<string> {
        try {
            logger.debug(`Generating response for user: ${username}`);

            // 会話履歴を取得して文脈を作成
            const conversation = this.history.getConversation(username);
            const context = conversation.map(msg =>
                `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
            ).join('\n');

            const promptText = `${BOT_CONFIG.SYSTEM_MESSAGE(username)}\n\n${context}\n\nUser: ${text}`;

            const result = await this.model.generateContent({
                contents: [{
                    role: "user",
                    parts: [{ text: promptText }],
                }],
                generationConfig: {
                    temperature: BOT_CONFIG.TEMPERATURE,
                    maxOutputTokens: BOT_CONFIG.MAX_TOKENS,
                },
                safetySettings: [],
            });

            const response = result.response.text();

            // 会話履歴に追加
            this.history.addMessage(username, 'user', text);
            this.history.addMessage(username, 'assistant', response);

            logger.debug(`Generated response: ${response}`);
            return response;

        } catch (error) {
            logger.error('Error generating response:', error);
            throw error;
        }
    }

    clearConversation(username: string): void {
        this.history.clearConversation(username);
        logger.info(`Cleared conversation history for user: ${username}`);
    }
}
