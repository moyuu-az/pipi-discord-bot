import {
    Client,
    GatewayIntentBits,
    Message,
    Events,
    Collection,
    REST,
    Routes
} from 'discord.js';
import { GeminiChat } from './gemini';
import { logger } from '../utils/logger';
import * as joinTalkCommand from '../commands/talk';

/**
 * Deploys slash commands to Discord
 * @param applicationId - Discord application ID
 * @param token - Discord bot token
 */
async function deployCommands(applicationId: string, token: string) {
    try {
        const commands = [joinTalkCommand.data.toJSON()];
        const rest = new REST().setToken(token);

        logger.info('Initiating slash command registration process');

        await rest.put(
            Routes.applicationCommands(applicationId),
            { body: commands }
        );
        
        logger.info(`Successfully registered ${commands.length} application commands: ${commands.map(c => c.name).join(', ')}`);
    } catch (error) {
        logger.error('Error occurred during command registration:', error);
        throw error;
    }
}

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
            GatewayIntentBits.GuildVoiceStates,
        ],
    });

    // Initialize commands collection
    client.commands = new Collection();
    client.commands.set(joinTalkCommand.data.name, joinTalkCommand);

    /**
     * Event handler for when the client is ready
     * Registers slash commands with Discord
     */
    client.once(Events.ClientReady, async () => {
        logger.info('Discord bot initialization complete');

        if (client.user && process.env.APPLICATION_ID) {
            logger.info(`Logged in as ${client.user.tag}`);

            // Register slash commands on startup
            try {
                await deployCommands(
                    process.env.APPLICATION_ID,
                    process.env.DISCORD_TOKEN || ''
                );
            } catch (error) {
                logger.error('Failed to register commands during startup:', error);
            }
        }
    });

    /**
     * Event handler for slash command interactions
     */
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            logger.error('Command execution failed:', error);
            await interaction.reply('An error occurred while executing the command.');
        }
    });

    /**
     * Event handler for regular message interactions
     */
    client.on(Events.MessageCreate, async (message: Message) => {
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
            logger.info(`Successfully sent response to ${username}`);

        } catch (error) {
            logger.error('Message processing error:', error);
            await message.reply('エラーが発生しました。');
        }
    });

    return client;
}

// Add commands property to Client type
declare module 'discord.js' {
    export interface Client {
        commands: Collection<string, any>;
    }
}
