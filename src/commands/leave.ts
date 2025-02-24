import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
} from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('leave')
    .setDescription('ボイスチャンネルから退出するよ！');

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        // インタラクションを確認するだけで、メッセージは送信しない
        await interaction.deferReply({ ephemeral: true });
        await interaction.deleteReply();

        const guildId = interaction.guildId;
        if (!guildId) {
            logger.warn('Command used outside of guild');
            return;
        }

        const connection = getVoiceConnection(guildId);

        if (!connection) {
            logger.warn('No voice connection found');
            return;
        }

        connection.destroy();
        logger.info(`Left voice channel in guild: ${guildId}`);

    } catch (error) {
        logger.error('Error leaving voice channel:', error);
    }
}