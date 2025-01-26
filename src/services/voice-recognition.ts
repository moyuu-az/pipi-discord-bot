import { VoiceConnection, EndBehaviorType } from '@discordjs/voice';
import { SpeechClient, protos } from '@google-cloud/speech';
import { logger } from '../utils/logger';
import { GeminiChat } from './gemini';
import { OpusEncoder } from '@discordjs/opus';

export class VoiceRecognition {
    private geminiChat: GeminiChat;
    private speechClient: SpeechClient;
    private opusEncoder: OpusEncoder;

    constructor(geminiChat: GeminiChat) {
        this.geminiChat = geminiChat;
        this.speechClient = new SpeechClient();
        this.opusEncoder = new OpusEncoder(48000, 2);
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
                // Skip silence data
                if (!(data.length === 3 && data[0] === 0xf8)) {
                    try {
                        // Each chunk is decoded individually
                        const pcmData = this.decodeToPCM(data);
                        pcmChunks.push(pcmData);
                    } catch (error) {
                        logger.error('Error decoding chunk:', error);
                    }
                } else {
                    logger.info('Skipping silence data');
                }
            });

            subscription.on('end', async () => {
                try {
                    if (pcmChunks.length === 0) {
                        logger.info('No audio data received');
                        return;
                    }

                    // Combine all decoded PCM chunks
                    const fullPCMBuffer = Buffer.concat(pcmChunks);
                    logger.info(`Total PCM data size: ${fullPCMBuffer.length} bytes`);

                    try {
                        // Convert stereo to mono
                        const monoData = this.stereoToMono(fullPCMBuffer);
                        logger.info(`Converted to mono: ${monoData.length} bytes`);

                        // Send processed audio data to Speech-to-Text
                        await this.processAudioData(monoData);

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

    /**
     * Decodes a single Opus packet to PCM
     */
    private decodeToPCM(opusPacket: Buffer): Buffer {
        try {
            return this.opusEncoder.decode(opusPacket);
        } catch (error) {
            logger.error('Error decoding Opus packet:', error);
            throw error;
        }
    }

    /**
     * Converts stereo audio data to mono
     */
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

    private async processAudioData(audioBuffer: Buffer): Promise<void> {
        try {
            logger.info(`Sending audio data to Speech-to-Text: ${audioBuffer.length} bytes`);

            const request: protos.google.cloud.speech.v1.IRecognizeRequest = {
                audio: {
                    content: audioBuffer.toString('base64'),
                },
                config: {
                    encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.LINEAR16,
                    sampleRateHertz: 48000,  // Updated to match Opus decoder settings
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
                    const reply = await this.geminiChat.getResponse(transcription, 'user');
                    logger.info(`AI Response: ${reply}`);
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
