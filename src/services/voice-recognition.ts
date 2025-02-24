import { VoiceConnection, EndBehaviorType, createAudioPlayer, NoSubscriberBehavior, getVoiceConnection, AudioPlayerStatus } from '@discordjs/voice';
import { SpeechClient, protos } from '@google-cloud/speech';
import { logger } from '../utils/logger';
import { GeminiChat } from './gemini';
import { OpusEncoder } from '@discordjs/opus';
import { VoiceSynthesizer } from './voice';
import { Client } from 'discord.js';

export class VoiceRecognition {
    private geminiChat: GeminiChat;
    private speechClient: SpeechClient;
    private opusEncoder: OpusEncoder;
    private discordClient: Client;
    private isProcessing: boolean = false;
    private audioPlayer: any = null;
    private skipCount: number = 0;
    private readonly MAX_SKIP_COUNT = 10;

    constructor(geminiChat: GeminiChat, discordClient: Client) {
        this.geminiChat = geminiChat;
        this.speechClient = new SpeechClient();
        this.opusEncoder = new OpusEncoder(48000, 2);
        this.discordClient = discordClient;
    }

    async startListening(connection: VoiceConnection, userId: string) {
        if (this.isProcessing) {
            this.skipCount++;
            logger.info('Currently processing, skipping new voice input');

            if (this.skipCount >= this.MAX_SKIP_COUNT) {
                logger.warn(`Max skip count reached (${this.MAX_SKIP_COUNT}), forcing reset...`);
                this.isProcessing = false;
                this.skipCount = 0;
                return;
            }
            return;
        }

        try {
            const pcmChunks: Buffer[] = [];

            const subscription = connection.receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 1000
                }
            });

            logger.info(`Started listening to user: ${userId}`);
            this.isProcessing = true;

            subscription.on('data', (data: Buffer) => {
                if (!(data.length === 3 && data[0] === 0xf8)) {
                    try {
                        const pcmData = this.decodeToPCM(data);
                        pcmChunks.push(pcmData);
                    } catch (error) {
                        logger.error('Error decoding chunk:', error);
                    }
                }
            });

            subscription.on('end', async () => {
                try {
                    if (pcmChunks.length === 0) {
                        logger.info('No audio data received');
                        this.isProcessing = false;
                        return;
                    }

                    const fullPCMBuffer = Buffer.concat(pcmChunks);
                    logger.info(`Total PCM data size: ${fullPCMBuffer.length} bytes`);

                    try {
                        const monoData = this.stereoToMono(fullPCMBuffer);
                        logger.info(`Converted to mono: ${monoData.length} bytes`);

                        await this.processAudioData(monoData, connection, userId);

                    } catch (error) {
                        logger.error('Error processing audio data:', error);
                    }
                } catch (error) {
                    logger.error('Error finalizing audio stream:', error);
                    this.isProcessing = false;
                }
            });

        } catch (error) {
            logger.error('Error in voice recognition:', error);
            this.isProcessing = false;
            throw error;
        }
    }

    private decodeToPCM(opusPacket: Buffer): Buffer {
        try {
            return this.opusEncoder.decode(opusPacket);
        } catch (error) {
            logger.error('Error decoding Opus packet:', error);
            throw error;
        }
    }

    private stereoToMono(stereoData: Buffer): Buffer {
        const monoData = Buffer.alloc(stereoData.length / 2);
        for (let i = 0; i < monoData.length; i += 2) {
            const j = i * 2;
            if (j + 1 < stereoData.length) {
                const left = stereoData.readInt16LE(j);
                const right = stereoData.readInt16LE(j + 2);
                const mono = Math.floor((left + right) / 2);
                monoData.writeInt16LE(mono, i);
            }
        }
        return monoData;
    }

    private async processAudioData(audioBuffer: Buffer, connection: VoiceConnection, userId: string): Promise<void> {
        try {
            logger.info(`Sending audio data to Speech-to-Text: ${audioBuffer.length} bytes`);

            const request: protos.google.cloud.speech.v1.IRecognizeRequest = {
                audio: {
                    content: audioBuffer.toString('base64'),
                },
                config: {
                    encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.LINEAR16,
                    sampleRateHertz: 48000,
                    languageCode: 'ja-JP',
                    model: 'default',
                    enableAutomaticPunctuation: true,
                    useEnhanced: true,
                    metadata: {
                        interactionType: protos.google.cloud.speech.v1.RecognitionMetadata.InteractionType.DICTATION,
                        recordingDeviceType: protos.google.cloud.speech.v1.RecognitionMetadata.RecordingDeviceType.OTHER_INDOOR_DEVICE,
                    }
                },
            };

            const [response] = await this.speechClient.recognize(request);
            logger.info("Speech-to-Text response: ", response);

            if (response.results && response.results.length > 0) {
                const transcription = response.results
                    .map(result => result.alternatives?.[0]?.transcript || '')
                    .join('\n');

                logger.info(`Transcription: ${transcription}`);

                if (transcription) {
                    const user = await this.discordClient.users.fetch(userId);
                    const username = user.username;

                    // 新しいチャンネルIDを使用
                    const channel = await this.discordClient.channels.fetch('1343057152285343825');
                    if (channel?.isTextBased() && 'send' in channel) {
                        await channel.send('───────────────────');
                        await channel.send(`💬 質問:\n${transcription}`);
                    }

                    const reply = await this.geminiChat.getResponse(transcription, username);

                    const synthesizer = new VoiceSynthesizer();
                    const audioResource = await synthesizer.synthesizeVoice(reply);

                    // ボットの応答もチャットに送信
                    if (channel?.isTextBased() && 'send' in channel) {
                        await channel.send(`🤖 さとうの返答:\n${reply}`);
                        await channel.send('───────────────────');
                    }

                    const player = createAudioPlayer({
                        behaviors: {
                            noSubscriber: NoSubscriberBehavior.Pause,
                        },
                    });

                    this.audioPlayer = player;
                    connection.subscribe(player);
                    player.play(audioResource);

                    player.on(AudioPlayerStatus.Idle, () => {
                        logger.info('Audio playback completed');
                        this.isProcessing = false;
                    });

                    player.on('error', error => {
                        logger.error('Error in audio playback:', error);
                        this.isProcessing = false;
                    });
                }
            } else {
                logger.info('No transcription results received');
                this.isProcessing = false;
            }
        } catch (error) {
            logger.error('Error in Speech-to-Text processing:', error);
            this.isProcessing = false;
            throw error;
        }
    }
}
