import axios from 'axios';
import { Readable } from 'stream';
import { createAudioResource } from '@discordjs/voice';
import { logger } from '../utils/logger';

interface VoiceConfig {
    model_id: number;
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
            model_id: 0,
            speaker_id: 0,
            sdp_ratio: 0.2,
            noise: 0.6,
            noisew: 0.8,
            length: 1.0,
            language: "JP",
            style: "02",
            style_weight: 1
        };
    }

    async synthesizeVoice(text: string) {
        try {
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

            logger.info('Voice synthesis successful');

            // ArrayBuffer から AudioResource を作成
            const buffer = Buffer.from(response.data);
            const bufferStream = new Readable();
            bufferStream.push(buffer);
            bufferStream.push(null);

            const audioResource = createAudioResource(bufferStream);
            return audioResource;

        } catch (error) {
            logger.error('Voice synthesis failed:', error);
            throw error;
        }
    }
}