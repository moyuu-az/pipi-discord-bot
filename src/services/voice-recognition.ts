import { VoiceConnection, EndBehaviorType, createAudioPlayer, NoSubscriberBehavior, getVoiceConnection } from '@discordjs/voice';
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

    constructor(geminiChat: GeminiChat, discordClient: Client) {
        this.geminiChat = geminiChat;
        this.speechClient = new SpeechClient();
        this.opusEncoder = new OpusEncoder(48000, 2);
        this.discordClient = discordClient;
    }

    async startListening(connection: VoiceConnection, userId: string) {
        try {
            const pcmChunks: Buffer[] = [];

            const subscription = connection.receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 1000
                }
            });

            logger.info(`Started listening to user: ${userId}`);

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
                }
            });

        } catch (error) {
            logger.error('Error in voice recognition:', error);
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
                    // ユーザー名を取得
                    const user = await this.discordClient.users.fetch(userId);
                    const username = user.username;
                    logger.info(`Processing response for user: ${username}`);

                    // AIの返答を取得（実際のユーザー名を使用）
                    const reply = await this.geminiChat.getResponse(transcription, username);
                    logger.info(`AI Response: ${reply}`);

                    const synthesizer = new VoiceSynthesizer();
                    const audioResource = await synthesizer.synthesizeVoice(reply);

                    const player = createAudioPlayer({
                        behaviors: {
                            noSubscriber: NoSubscriberBehavior.Pause,
                        },
                    });

                    connection.subscribe(player);
                    player.play(audioResource);

                    player.on('stateChange', (oldState, newState) => {
                        logger.info(`Audio player state changed from ${oldState.status} to ${newState.status}`);
                    });

                    player.on('error', error => {
                        logger.error('Error in audio playback:', error);
                    });
                }
            } else {
                logger.info('No transcription results received');
            }

        } catch (error) {
            logger.error('Error in Speech-to-Text processing:', error);
            throw error;
        }
    }
}
