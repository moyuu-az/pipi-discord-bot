import axios from 'axios';
import { Readable } from 'stream';
import { createAudioResource, StreamType } from '@discordjs/voice';
import { logger } from '../utils/logger';

interface VoiceConfig {
    model_name: string;
    speaker_id: number;
    sdp_ratio: number;
    noise: number;
    noisew: number;
    length: number;
    language: string;
    style: string;
    style_weight: number;
}

export class VoiceSynthesizer {
    private readonly baseUrl: string;
    private readonly config: VoiceConfig;

    constructor(baseUrl: string = 'http://192.168.1.50:5000') {
        this.baseUrl = baseUrl;
        this.config = {
            model_name: "Anneli",
            speaker_id: 0,
            sdp_ratio: 0.2,
            noise: 0.6,
            noisew: 0.8,
            length: 1.0,
            language: "JP",
            style: "落ち着き",
            style_weight: 10
        };
    }

    async synthesizeVoice(text: string) {
        try {
            logger.info('Starting voice synthesis for text:', text);

            const response = await axios.post(
                `${this.baseUrl}/voice`,
                null,
                {
                    params: {
                        text,
                        ...this.config,
                        auto_split: true,
                        split_interval: 0.05
                    },
                    responseType: 'arraybuffer',
                    headers: {
                        'accept': 'audio/wav'
                    }
                }
            );

            logger.info('Voice synthesis API call successful');

            // ArrayBufferからStreamを作成
            const buffer = Buffer.from(response.data);
            const stream = new Readable();
            stream.push(buffer);
            stream.push(null);

            // AudioResourceを作成（StreamTypeを明示的に指定）
            const audioResource = createAudioResource(stream, {
                inputType: StreamType.Arbitrary,
                inlineVolume: true
            });

            // ボリュームの調整（必要に応じて）
            if (audioResource.volume) {
                audioResource.volume.setVolume(1.0);
            }

            logger.info('Audio resource created successfully');
            return audioResource;

        } catch (error) {
            logger.error('Voice synthesis failed:', error);
            throw new Error('音声合成に失敗しました');
        }
    }
}
