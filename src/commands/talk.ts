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

            // ボイスチャンネルに接続するよ〜！🎤
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false  // 自分の声も聞こえるようにしておく！
            });

            // プレイヤーの設定もバッチリ！🎵
            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });

            // 接続を購読！📡
            connection.subscribe(player);

            // Geminiちゃんの初期化！🤖✨
            const geminiChat = new GeminiChat(process.env.GEMINI_API_KEY || '');

            // 最初の挨拶を準備！💖
            const synthesizer = new VoiceSynthesizer();
            try {
                const audioResource = await synthesizer.synthesizeVoice('ヘルタだよ！よろしくね！');
                player.play(audioResource);
            } catch (error) {
                logger.error('Error playing initial voice:', error);
            }

            // 音声認識の準備だよ〜！🎧
            const recognition = new VoiceRecognition(geminiChat, interaction.client);
            connection.receiver.speaking.on('start', (userId) => {
                recognition.startListening(connection, userId);
            });

            // プレイヤーのイベントもしっかり監視！👀
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
