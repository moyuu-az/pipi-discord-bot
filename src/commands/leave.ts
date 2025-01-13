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
        // ギルドIDを取得
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply('ギルドでしか使えないコマンドだよ〜！😅');
            return;
        }

        // 現在のボイス接続を取得
        const connection = getVoiceConnection(guildId);

        if (!connection) {
            await interaction.reply('今はボイスチャンネルに入ってないよ〜！🤔');
            return;
        }

        // ボイスチャンネルから切断
        connection.destroy();

        await interaction.reply('バイバイ！また来るね〜！👋✨');
        logger.info(`Left voice channel in guild: ${guildId}`);

    } catch (error) {
        logger.error('Error leaving voice channel:', error);
        await interaction.reply('ごめんね！退出できなかったよ...😢');
    }
}