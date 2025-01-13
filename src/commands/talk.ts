import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ChannelType,
    VoiceChannel
} from 'discord.js';
import {
    joinVoiceChannel,
    createAudioPlayer,
    NoSubscriberBehavior,
    AudioPlayerStatus
} from '@discordjs/voice';
import { logger } from '../utils/logger';
import { VoiceSynthesizer } from '../services/voice';

export const data = new SlashCommandBuilder()
    .setName('talk')
    .setDescription('ボイスチャンネルに参加するよ！');

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        const channel = await interaction.client.channels.fetch('1328319783489376303');

        if (channel?.type === ChannelType.GuildVoice) {
            const voiceChannel = channel as VoiceChannel;

            // ボイスチャンネルに接続
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            // プレイヤーの設定
            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });

            // 接続を購読
            connection.subscribe(player);

            // 音声合成
            const synthesizer = new VoiceSynthesizer();
            const audioResource = await synthesizer.synthesizeVoice('こんにちは！私はぴぴです');

            // 音声を再生
            player.play(audioResource);

            // 再生完了を待つ
            player.on(AudioPlayerStatus.Idle, () => {
                logger.info('Voice playback completed');
            });

            player.on('error', error => {
                logger.error('Error playing audio:', error);
            });

            await interaction.reply('はーい！ボイスチャットに参加したよ〜！🎤✨');
            logger.info(`Joined voice channel: ${voiceChannel.name}`);
        }
    } catch (error) {
        logger.error('Error joining voice channel:', error);
        await interaction.reply('ごめんね！ボイスチャットに参加できなかったよ...😢');
    }
}
