import { Client, GatewayIntentBits, Message } from 'discord.js';
import { GeminiChat } from './gemini';
import { logger } from '../utils/logger';

/**
 * Sets up and configures the Discord bot client
 * @param geminiChat - Initialized GeminiChat instance
 * @returns Discord.js Client instance
 */
export function setupDiscordBot(geminiChat: GeminiChat): Client {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages,
        ],
    });

    client.once('ready', () => {
        logger.info('Discord bot is ready');
        if (client.user) {
            logger.info(`Logged in as ${client.user.tag}`);
        }
    });

    client.on('messageCreate', async (message: Message) => {
        if (message.author.bot) return;
        if (!message.mentions.has(client.user!)) return;

        try {
            const content = message.content
                .replace(`<@!${client.user!.id}>`, '')
                .replace(`<@${client.user!.id}>`, '')
                .trim();

            const username = message.author.username;
            logger.info(`Processing message from ${username}: ${content}`);

            const response = await geminiChat.getResponse(content, username);
            await message.reply(response);
            logger.info(`Sent response to ${username}`);

        } catch (error) {
            logger.error('Error processing message:', error);
            await message.reply('エラーが発生しました。');
        }
    });

    return client;
}
