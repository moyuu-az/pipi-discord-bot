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
import { VoiceRecognition } from '../services/voice-recognition';
import { GeminiChat } from '../services/gemini';

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

            // Geminiチャットの初期化（環境変数から取得）
            const geminiChat = new GeminiChat(process.env.GEMINI_API_KEY || '');

            // ボットの音声を再生
            const synthesizer = new VoiceSynthesizer();
            const audioResource = await synthesizer.synthesizeVoice('ヘルタだよ');
            player.play(audioResource);

            // 音声認識を開始
            const recognition = new VoiceRecognition(geminiChat);
            connection.receiver.speaking.on('start', (userId) => {
                recognition.startListening(connection, userId);
            });

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
