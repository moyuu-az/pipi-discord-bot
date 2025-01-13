import dotenv from 'dotenv';
import { GeminiChat } from './services/gemini';
import { setupDiscordBot } from './services/discord';
import { logger } from './utils/logger';

dotenv.config();

async function main() {
    try {
        const geminiChat = new GeminiChat(process.env.GEMINI_API_KEY || '');
        const client = setupDiscordBot(geminiChat);
        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        logger.error('Failed to start the application:', error);
        process.exit(1);
    }
}

main();
