// File chính cho Gemini AI Service
// Được tối ưu để chỉ tải SDK Gemini khi thực sự cần thiết nhằm giảm kích thước bundle ban đầu
import type { GoogleGenAI } from '@google/genai';
import { decode, decodeAudioData } from './audioUtils';

// --- Re-export từ các module khác để giữ backward compatibility ---
export { saveMedia, getMedia } from './indexedDBService';
export { getWeatherForLocation, type WeatherData } from './weatherService';
export { 
    notifyTvState, 
    notifyTvInteractionStarted, 
    startLiveSession, 
    stopLiveSession,
    clearConversationHistory,
    getConversationHistory
} from './liveSessionService';

// --- Lazy load Gemini SDK để giảm bundle ---
type GenAiRuntime = typeof import('@google/genai');

let runtimePromise: Promise<GenAiRuntime> | null = null;
let runtimeInstance: GenAiRuntime | null = null;
let aiInstance: GoogleGenAI | null = null;
let modalityInstance: GenAiRuntime['Modality'] | null = null;

const loadRuntime = async (): Promise<GenAiRuntime> => {
    if (runtimeInstance) return runtimeInstance;
    if (!runtimePromise) {
        runtimePromise = import('@google/genai');
    }
    runtimeInstance = await runtimePromise;
    return runtimeInstance;
};

export const getGenAiRuntime = async (): Promise<GenAiRuntime> => {
    return loadRuntime();
};

export const getModality = async (): Promise<GenAiRuntime['Modality']> => {
    if (modalityInstance) return modalityInstance;
    const runtime = await loadRuntime();
    modalityInstance = runtime.Modality;
    return modalityInstance;
};

export const getAi = async (): Promise<GoogleGenAI> => {
    if (aiInstance) return aiInstance;
    const runtime = await loadRuntime();
    if (!process.env.API_KEY) {
        throw new Error("Biến môi trường API_KEY chưa được đặt.");
    }
    aiInstance = new runtime.GoogleGenAI({ apiKey: process.env.API_KEY });
    return aiInstance;
};

// --- Voice Management ---
export const availableVoices = [
    { id: 'Zephyr', name: 'Zephyr (Mặc định)' },
    { id: 'Puck', name: 'Puck' },
    { id: 'Charon', name: 'Charon' },
    { id: 'Kore', name: 'Kore' },
    { id: 'Fenrir', name: 'Fenrir' },
];

// --- Text-to-Speech Test ---
export const textToSpeechTest = async (voiceName: string): Promise<void> => {
    try {
        const [ai, Modality] = await Promise.all([
            getAi(),
            getModality(),
        ]);
        const testText = 'Alo alo một hai ba bốn, Rio đang test loa, mọi người nghe rõ Rio nói gì không ạ';
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: testText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            // Use a temporary AudioContext to play this one-off sound, ensuring it's unblocked by user gesture.
            const tempAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            if (tempAudioContext.state === 'suspended') {
                await tempAudioContext.resume();
            }
            const audioBuffer = await decodeAudioData(decode(base64Audio), tempAudioContext, 24000, 1);
            const source = tempAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(tempAudioContext.destination);
            source.start();
            source.onended = () => {
                tempAudioContext.close();
            };
        }
    } catch (error) {
        console.error("Lỗi khi test giọng nói:", error);
        throw new Error("Đã xảy ra lỗi khi thử giọng nói. Vui lòng thử lại.");
    }
};
