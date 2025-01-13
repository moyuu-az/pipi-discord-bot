import { VoiceConnection, EndBehaviorType } from '@discordjs/voice';
import { Transform } from 'stream';
import { logger } from '../utils/logger';
import { GeminiChat } from './gemini';

export class VoiceRecognition {
    private geminiChat: GeminiChat;
    private audioStream: Transform;

    constructor(geminiChat: GeminiChat) {
        this.geminiChat = geminiChat;

        this.audioStream = new Transform({
            transform(chunk, encoding, callback) {
                const buffer = Buffer.from(chunk);
                callback(null, buffer);
            }
        });
    }

    async startListening(connection: VoiceConnection, userId: string) {
        try {
            const chunks: Buffer[] = [];

            // バッファサイズはoptionsから削除して、内部で管理するように変更！
            const subscription = connection.receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 1000
                }
            });

            logger.info(`Started listening to user: ${userId}`);

            subscription.on('data', async (data: Buffer) => {
                try {
                    chunks.push(data);

                    // メモリ管理は維持！
                    if (chunks.length > 1000) {
                        logger.info('Buffer limit reached, processing data...');
                        await this.processAudioData(Buffer.concat(chunks));
                        chunks.length = 0;
                    }
                } catch (error) {
                    logger.error('Error processing audio chunk:', error);
                }
            });

            subscription.on('end', async () => {
                try {
                    if (chunks.length === 0) {
                        logger.info('No audio data received');
                        return;
                    }

                    const audioBuffer = Buffer.concat(chunks);
                    await this.processAudioData(audioBuffer);

                } catch (error) {
                    logger.error('Error finalizing audio stream:', error);
                }
            });

        } catch (error) {
            logger.error('Error in voice recognition:', error);
            throw error;
        }
    }

    private async processAudioData(audioBuffer: Buffer): Promise<void> {
        try {
            logger.info(`Processing audio data: ${audioBuffer.length} bytes`);
            // ここに音声認識の処理を追加予定！

        } catch (error) {
            logger.error('Error processing audio data:', error);
            throw error;
        }
    }
}
