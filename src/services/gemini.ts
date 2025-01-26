import { GoogleGenerativeAI } from '@google/generative-ai';
import { BOT_CONFIG } from '../config/constants';
import { logger } from '../utils/logger';

/**
 * Handles communication with the Gemini AI API
 */
export class GeminiChat {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: BOT_CONFIG.MODEL_NAME,
        });
        logger.info('GeminiChat initialized successfully');
    }

    /**
     * Generate a response from Gemini AI
     * @param text - User input text
     * @param username - Discord username of the sender
     * @returns Promise<string> - AI generated response
     */
    async getResponse(text: string, username: string): Promise<string> {
        try {
            logger.debug(`Generating response for user: ${username}`);

            const promptText = `${BOT_CONFIG.SYSTEM_MESSAGE(username)}\n\nUser: ${text}`;

            const result = await this.model.generateContent({
                contents: [{
                    role: "ヘルタ",
                    parts: [{ text: promptText }],
                }],
                generationConfig: {
                    temperature: BOT_CONFIG.TEMPERATURE,
                    maxOutputTokens: BOT_CONFIG.MAX_TOKENS,
                },
                safetySettings: [],
            });

            const response = result.response.text();
            logger.debug(`Generated response: ${response}`);
            return response;

        } catch (error) {
            logger.error('Error generating response:', error);
            throw error;
        }
    }
}
