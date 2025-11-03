import { getAi, getModality } from './geminiService';
import { RioState } from '../types';

interface Alarm {
    id: number;
    time: Date;
    label: string;
    type: 'alarm' | 'reminder';
    timerId: number;
}

// --- Module-level state ---
const activeAlarms: Alarm[] = [];
let nextAlarmId = 1;
let alarmAudioContext: AudioContext | null = null;
let currentRingingAlarm: {
    id: number;
    stop: () => void;
} | null = null;

// --- Callbacks to communicate with the UI ---
type AlarmRingCallback = (label: string, id: number, type: 'alarm' | 'reminder') => void;
type StateChangeCallback = (state: RioState, status?: string) => void;

let onAlarmRing: AlarmRingCallback = () => {};
let onStateChange: StateChangeCallback = () => {};

export const registerCallbacks = (ringCb: AlarmRingCallback, stateCb: StateChangeCallback) => {
    onAlarmRing = ringCb;
    onStateChange = stateCb;
};

// This function must be called from within a user gesture handler to unblock the audio context.
export const initAlarmAudio = () => {
    if (!alarmAudioContext || alarmAudioContext.state === 'closed') {
        alarmAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (alarmAudioContext.state === 'suspended') {
        // Attempt to resume. If this fails, audio won't play, but the app won't crash.
        alarmAudioContext.resume().catch(e => console.error("Failed to resume alarm audio context:", e));
    }
};

const getAlarmAudioContext = (): AudioContext | null => {
    // This ensures there's always a context, even if it's suspended.
    // The init function is responsible for trying to unsuspend it.
    if (!alarmAudioContext || alarmAudioContext.state === 'closed') {
        alarmAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
     if (alarmAudioContext.state === 'suspended') {
        alarmAudioContext.resume();
    }
    return alarmAudioContext;
};


// --- Helper Functions (copied for independence) ---
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
  
async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
): Promise<AudioBuffer> {
    const sampleRate = 24000;
    const numChannels = 1;
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

const speak = async (text: string): Promise<void> => {
    try {
        const [ai, Modality] = await Promise.all([
            getAi(),
            getModality(),
        ]);
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' }, // A different voice for alarms
                  },
              },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            return new Promise(async (resolve) => {
                const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                const audioBuffer = await decodeAudioData(decode(base64Audio), tempCtx);
                const source = tempCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(tempCtx.destination);
                source.start();
                source.onended = () => {
                    tempCtx.close();
                    resolve();
                };
            });
        }
    } catch (error) {
        console.error("Không thể phát âm thanh báo thức:", error);
    }
};

// FIX: Changed return type from Promise<AudioBufferSourceNode> to Promise<OscillatorNode> to match the returned object.
const createReminderSound = async (): Promise<OscillatorNode> => {
    const ctx = getAlarmAudioContext();
    if (!ctx) return new OscillatorNode(ctx); // Return dummy node if context fails
    const duration = 1.5;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + duration * 0.8);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    return oscillator;
};

const createAlarmSound = async (): Promise<AudioBufferSourceNode> => {
    const ctx = getAlarmAudioContext();
    if (!ctx) return new AudioBufferSourceNode(ctx); // Return dummy node if context fails
    const duration = 30;
    const sampleRate = ctx.sampleRate;
    const frameCount = sampleRate * duration;
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    const freq1 = 880;
    const freq2 = 1240;
    const switchInterval = 0.12; 

    for (let i = 0; i < frameCount; i++) {
        const time = i / sampleRate;
        const whichFreq = Math.floor(time / switchInterval) % 2 === 0 ? freq1 : freq2;
        data[i] = Math.sin(2 * Math.PI * whichFreq * time) * 0.25 * (1 - time / duration); // Fade out over duration
    }
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    return source;
};

const playReminderSequence = async (label: string) => {
    onStateChange(RioState.SPEAKING, `Nhắc nhở: ${label}`);
    await speak(`Đã đến giờ ${label}`);
    const soundSource = await createReminderSound();
    const ctx = getAlarmAudioContext();
    if (ctx) {
        soundSource.start();
        soundSource.stop(ctx.currentTime + 1.5);
    }
    setTimeout(() => onStateChange(RioState.IDLE, "Rio đang nghỉ ngơi..."), 2000);
};

const playAlarmSequence = (label: string, id: number) => {
    onStateChange(RioState.ALARM_RINGING, label);
    
    let audioSource: AudioBufferSourceNode | null = null;
    let loopIntervalId: number;
    
    const masterTimeoutId = window.setTimeout(() => {
        stopCurrentAlarm();
    }, 5 * 60 * 1000); // 5 minutes total

    const stop = () => {
        clearTimeout(masterTimeoutId);
        clearInterval(loopIntervalId);
        if (audioSource) {
            try { audioSource.stop(); } catch (e) { /* ignore */ }
        }
        audioSource = null;
        if (currentRingingAlarm?.id === id) {
            currentRingingAlarm = null;
        }
        onStateChange(RioState.IDLE, "Báo thức đã tắt.");
    };

    currentRingingAlarm = { id, stop };
    
    const loop = async () => {
        if (currentRingingAlarm?.id !== id) {
             clearInterval(loopIntervalId);
             return;
        }

        await speak(`Này bạn ơi, đến giờ ${label} rồi!`);

        if (currentRingingAlarm?.id !== id) {
             clearInterval(loopIntervalId);
             return;
        }

        audioSource = await createAlarmSound();
        audioSource.start();
    };

    loop(); // First run
    loopIntervalId = window.setInterval(loop, 32 * 1000); // 30s music + 2s buffer
};

const ring = (alarm: Alarm) => {
    onAlarmRing(alarm.label, alarm.id, alarm.type);
    
    const index = activeAlarms.findIndex(a => a.id === alarm.id);
    if (index !== -1) activeAlarms.splice(index, 1);

    if (alarm.type === 'alarm') {
        playAlarmSequence(alarm.label, alarm.id);
    } else {
        playReminderSequence(alarm.label);
    }
};

export const setAlarm = (time: Date, label: string) => {
    const now = Date.now();
    const delay = time.getTime() - now;

    if (delay < 0) {
        console.warn("Không thể đặt báo thức trong quá khứ.");
        return;
    }

    const id = nextAlarmId++;
    
    const lowerLabel = label.toLowerCase();
    const type = lowerLabel.includes('thức dậy') || lowerLabel.includes('báo thức') ? 'alarm' : 'reminder';

    const newAlarm: Alarm = { id, time, label, type, timerId: 0 };
    
    newAlarm.timerId = window.setTimeout(() => ring(newAlarm), delay);
    
    activeAlarms.push(newAlarm);
};

export const stopCurrentAlarm = () => {
    if (currentRingingAlarm) {
        currentRingingAlarm.stop();
    }
};


export const cancelAlarm = (id: number) => {
    const index = activeAlarms.findIndex(a => a.id === id);
    if (index !== -1) {
        clearTimeout(activeAlarms[index].timerId);
        activeAlarms.splice(index, 1);
    }
};

export const getActiveAlarms = (): Omit<Alarm, 'timerId' | 'type'>[] => {
    return activeAlarms.map(({ timerId, type, ...rest }) => rest);
};

// --- Sound Effects ---

const playTone = (freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.1) => {
    const ctx = getAlarmAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
};

// 'ting' when Rio starts speaking
export const playMessageTing = () => {
    playTone(1200, 0.2, 'triangle', 0.08);
};

// A subtle 'boop' for minor state changes
export const playBoop = () => {
    playTone(440, 0.1, 'sine', 0.05);
};

// Cheerful sound for waking up
export const playWakeSound = () => {
    const ctx = getAlarmAudioContext();
    if (!ctx) return;
    playTone(880, 0.1, 'sine', 0.1);
    setTimeout(() => playTone(1046, 0.15, 'sine', 0.1), 100);
};

// Soft sound for going to sleep
export const playSleepSound = () => {
    const ctx = getAlarmAudioContext();
    if (!ctx) return;
    playTone(440, 0.2, 'sine', 0.1);
    setTimeout(() => playTone(330, 0.3, 'sine', 0.1), 150);
};

// A glitchy sound for errors
export const playErrorSound = () => {
    playTone(150, 0.3, 'sawtooth', 0.1);
};
