import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ChannelType,
    VoiceChannel
} from 'discord.js';
import {
    joinVoiceChannel,
    createAudioPlayer,
    NoSubscriberBehavior
} from '@discordjs/voice';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('talk')
    .setDescription('ボイスチャンネルに参加するよ！');

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        const channel = await interaction.client.channels.fetch('1328319783489376303');

        if (channel?.type === ChannelType.GuildVoice) {
            const voiceChannel = channel as VoiceChannel;

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });

            connection.subscribe(player);

            await interaction.reply('はーい！ボイスチャットに参加したよ〜！🎤✨');
            logger.info(`Joined voice channel: ${voiceChannel.name}`);
        }
    } catch (error) {
        logger.error('Error joining voice channel:', error);
        await interaction.reply('ごめんね！ボイスチャットに参加できなかったよ...😢');
    }
}
