// Dịch vụ quản lý live session với Gemini AI
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { RioState, UserProfile, ChatMessage, IPTVChannel } from '../types';
import * as alarmService from './alarmService';
import * as iptvService from './iptvService';
import { getAi } from './geminiService';
import { decode, decodeAudioData, createBlob } from './audioUtils';
import { performGoogleSearch, findYouTubeVideo, setSearchCallbacks } from './searchService';
import { allFunctionDeclarations } from './functionDeclarations';
import { saveChatHistory, getChatHistory } from './indexedDBService';
import { 
    initializeWakeWordDetection, 
    detectWakeWord, 
    cleanupWakeWordDetection,
    isWakeWordServiceReady 
} from './wakeWordService';

// --- Module-level state ---
let session: any | null = null;
let inputAudioContext: AudioContext | null = null;
let outputAudioContext: AudioContext | null = null;
let microphoneStream: MediaStream | null = null;
let audioWorkletNode: AudioWorkletNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let isSpeaking = false;
let nextStartTime = 0;
const audioSources = new Set<AudioBufferSourceNode>();
let conversationHistory: ChatMessage[] = [];

// Flags
let deepSleepRequested = false;
let isTvActive = false;
let wasTvPlaying = false;
let channelJustOpened = false;
let videoJustOpened = false;
let globalWakeWordDetected = false;
let getCurrentStateCallback: GetCurrentStateCallback | null = null;

// Audio buffer đã được loại bỏ - chỉ dùng SherpaOnnx ASR để detect wake word realtime

// Idle timeout management
let idleTimeoutId: number | null = null;
const IDLE_TIMEOUT_MS = 30000;
let lastInputTime: number = 0;
let stateBeforeSpeaking: RioState | null = null;

// Session state
let currentSessionPromise: Promise<any> | null = null;
let currentUserWakeWord: string = '';

// AudioWorkletProcessor code
const audioProcessorWorklet = `
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0 && input[0].length > 0) {
      this.port.postMessage(input[0]);
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
`;

// --- Callback types ---
type StateChangeCallback = (state: RioState, status?: string) => void;
type HistoryUpdateCallback = (history: ChatMessage[]) => void;
type TranscriptionUpdateCallback = (message: ChatMessage | null) => void;
type PlayTvChannelCallback = (channel: IPTVChannel) => void;
type ResumeTvCallback = () => void;
type PlayYouTubeVideoCallback = (videoId: string, videoTitle: string) => void;
type SetVolumeCallback = (level: number) => void;
type SetBrightnessCallback = (level: number) => void;
type SessionEndCallback = () => void;
type GetCurrentStateCallback = () => RioState;

let onStateChange: StateChangeCallback = () => {};
let onHistoryUpdate: HistoryUpdateCallback = () => {};
let onTranscriptionUpdate: TranscriptionUpdateCallback = () => {};
let onPlayTvChannel: PlayTvChannelCallback = () => {};
let onResumeTv: ResumeTvCallback = () => {};
let onPlayYouTubeVideo: PlayYouTubeVideoCallback = () => {};
let onSetVolume: SetVolumeCallback = () => {};
let onSetBrightness: SetBrightnessCallback = () => {};
let onSessionEnd: SessionEndCallback = () => {};

// --- Public API ---
export const notifyTvState = (isActive: boolean) => {
    isTvActive = isActive;
};

export const notifyTvInteractionStarted = () => {
    if (isTvActive) {
        wasTvPlaying = true;
    }
};

export const getConversationHistory = (): ChatMessage[] => {
    return [...conversationHistory];
};

export const clearConversationHistory = async () => {
    conversationHistory = [];
    if (onHistoryUpdate) {
        onHistoryUpdate([]);
    }
    const { clearChatHistory } = await import('./indexedDBService');
    clearChatHistory().catch(err => {
        console.error("Lỗi khi xóa lịch sử trò chuyện:", err);
    });
};

// --- Helper Functions ---

/**
 * Kiểm tra xem state có cần wake word không (IDLE hoặc DEEP_SLEEP)
 */
const requiresWakeWord = (state: RioState): boolean => {
    return state === RioState.IDLE || state === RioState.ENTERING_DEEP_SLEEP;
};

/**
 * Reset idle timeout và set lại timer
 */
const resetIdleTimeout = (rioName: string, userWakeWord: string) => {
    if (idleTimeoutId) {
        clearTimeout(idleTimeoutId);
        idleTimeoutId = null;
    }
    
    lastInputTime = Date.now();
    idleTimeoutId = window.setTimeout(() => {
        const timeSinceLastInput = Date.now() - lastInputTime;
        if (timeSinceLastInput >= IDLE_TIMEOUT_MS - 1000) {
            onStateChange(RioState.IDLE, `${rioName} đang nghỉ. Nói '${userWakeWord}' để bắt đầu.`);
            idleTimeoutId = null;
        }
    }, IDLE_TIMEOUT_MS);
};

/**
 * Chuyển về LISTENING và set idle timeout
 */
const transitionToListening = (rioName: string, userWakeWord: string) => {
    if (idleTimeoutId) {
        clearTimeout(idleTimeoutId);
        idleTimeoutId = null;
    }
    onStateChange(RioState.LISTENING);
    resetIdleTimeout(rioName, userWakeWord);
};

/**
 * Xử lý emotional state từ output text
 */
const handleEmotionalState = (
    finalOutput: string,
    savedStateBeforeSpeaking: RioState | null,
    rioName: string,
    userWakeWord: string
): { hasEmotionalState: boolean; cleanedOutput: string } => {
    const emotionalTagMatch = finalOutput.match(/^\[(HAPPY|SAD|ANGRY|CONFUSED|NORMAL)\]\s*/);
    
    if (!emotionalTagMatch) {
        return { hasEmotionalState: false, cleanedOutput: finalOutput };
    }
    
    const tag = emotionalTagMatch[1];
    const cleanedOutput = finalOutput.replace(emotionalTagMatch[0], '');
    
    if (tag === 'NORMAL') {
        return { hasEmotionalState: false, cleanedOutput };
    }
    
    const emotionalState = RioState[tag as keyof typeof RioState];
    onStateChange(emotionalState);
    
    // Sau 3 giây, chuyển về trạng thái trước đó
    setTimeout(() => {
        if (getCurrentStateCallback && getCurrentStateCallback() === emotionalState) {
            if (savedStateBeforeSpeaking === RioState.LISTENING) {
                transitionToListening(rioName, userWakeWord);
            } else {
                onStateChange(RioState.IDLE, `${rioName} đang nghỉ. Nói '${userWakeWord}' để bắt đầu.`);
            }
        }
    }, 3000);
    
    return { hasEmotionalState: true, cleanedOutput };
};

// sendBufferedAudio đã được loại bỏ - chỉ dùng SherpaOnnx ASR realtime

/**
 * Xử lý tool call từ server
 */
const handleToolCall = async (fc: any) => {
    let result = "Đã xảy ra lỗi.";
    
    if (fc.name === 'get_information_from_web' && fc.args.query) {
        result = await performGoogleSearch(fc.args.query as string, (streamedText) => {
            onTranscriptionUpdate({ speaker: 'rio', text: streamedText });
        });
    } else if (fc.name === 'set_reminder' && fc.args.label && typeof fc.args.delay_minutes === 'number') {
        const { delay_minutes, label } = fc.args;
        const targetTime = new Date(Date.now() + delay_minutes * 60000);
        alarmService.setAlarm(targetTime, label as string);
        const timeFormatter = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });
        result = `Đã đặt lời nhắc "${label}" vào lúc ${timeFormatter.format(targetTime)}.`;
    } else if (fc.name === 'enter_deep_sleep') {
        deepSleepRequested = true;
        result = "Đã hiểu, đang vào chế độ ngủ sâu.";
    } else if (fc.name === 'open_tv_channel' && fc.args.channel_name) {
        const channel = await iptvService.findChannel(fc.args.channel_name as string);
        if (channel) {
            onPlayTvChannel(channel);
            result = `Ok, đang mở kênh ${channel.name} cho bạn đây.`;
            channelJustOpened = true;
        } else {
            result = `Rất tiếc, mình không tìm thấy kênh ${fc.args.channel_name}.`;
        }
    } else if (fc.name === 'play_youtube_video' && fc.args.query) {
        const videoInfo = await findYouTubeVideo(fc.args.query as string);
        if (videoInfo) {
            onPlayYouTubeVideo(videoInfo.id, videoInfo.title);
            result = `Ok, mình đang mở video "${videoInfo.title}" cho bạn.`;
            videoJustOpened = true;
        } else {
            result = `Rất tiếc, mình không tìm thấy video nào có tên "${fc.args.query}".`;
        }
    } else if (fc.name === 'set_volume' && typeof fc.args.level === 'number') {
        const level = Math.max(0, Math.min(100, fc.args.level));
        onSetVolume(level);
        result = `Ok, đã đặt âm lượng thành ${level}%.`;
    } else if (fc.name === 'set_screen_brightness' && typeof fc.args.level === 'number') {
        const level = Math.max(0, Math.min(100, fc.args.level));
        onSetBrightness(level);
        result = `Đã chỉnh độ sáng màn hình thành ${level}%.`;
    }

    if (currentSessionPromise) {
        currentSessionPromise.then(s => s.sendToolResponse({
            functionResponses: { id: fc.id, name: fc.name, response: { result } }
        }));
    }
};

/**
 * Phát audio từ server
 */
const playAudioOutput = async (audioData: string) => {
    if (!outputAudioContext) return;
    
    const currentState = getCurrentStateCallback ? getCurrentStateCallback() : RioState.IDLE;
    
    // Chỉ phát audio khi đã phát hiện wake word hoặc không ở trạng thái cần wake word
    if (requiresWakeWord(currentState) && !globalWakeWordDetected) {
        return;
    }
    
    if (!isSpeaking) {
        stateBeforeSpeaking = currentState;
        onTranscriptionUpdate(null);
        isSpeaking = true;
        onStateChange(RioState.SPEAKING);
    }

    const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
    const source = outputAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outputAudioContext.destination);
    source.onended = () => audioSources.delete(source);

    nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
    source.start(nextStartTime);
    nextStartTime += audioBuffer.duration;
    audioSources.add(source);
};

/**
 * Xử lý input transcription
 */
const handleInputTranscription = (
    text: string,
    userWakeWord: string,
    wakeWordDetected: boolean
): { wakeWordDetected: boolean } => {
    const currentState = getCurrentStateCallback ? getCurrentStateCallback() : RioState.IDLE;
    
    // Reset timeout khi có input mới (ngoài các trạng thái cần wake word)
    if (!requiresWakeWord(currentState) && idleTimeoutId) {
        lastInputTime = Date.now();
        clearTimeout(idleTimeoutId);
        idleTimeoutId = null;
    }
    
    if (requiresWakeWord(currentState)) {
        if (!wakeWordDetected && text.toLowerCase().includes(userWakeWord)) {
            if (isTvActive) {
                wasTvPlaying = true;
            }
            globalWakeWordDetected = true;
            onStateChange(RioState.LISTENING);
            onTranscriptionUpdate({ speaker: 'user', text });
            return { wakeWordDetected: true };
        }
        
        if (wakeWordDetected) {
            onTranscriptionUpdate({ speaker: 'user', text });
        }
    } else {
        onTranscriptionUpdate({ speaker: 'user', text });
    }
    
    return { wakeWordDetected: globalWakeWordDetected };
};

/**
 * Xử lý output transcription
 */
const handleOutputTranscription = (text: string) => {
    const currentState = getCurrentStateCallback ? getCurrentStateCallback() : RioState.IDLE;
    
    // Chỉ hiển thị output transcription khi đã phát hiện wake word hoặc không ở trạng thái cần wake word
    if (requiresWakeWord(currentState) && !globalWakeWordDetected) {
        return;
    }
    
    onTranscriptionUpdate({ speaker: 'rio', text });
};

/**
 * Xử lý khi bị interrupt
 */
const handleInterruption = () => {
    for (const source of audioSources) {
        source.stop();
    }
    audioSources.clear();
    nextStartTime = 0;
    isSpeaking = false;
    
    if (session) {
        onStateChange(RioState.LISTENING);
    }
};

/**
 * Xử lý turn complete
 */
const handleTurnComplete = async (
    finalInput: string,
    finalOutput: string,
    userProfile: UserProfile,
    rioName: string,
    userWakeWord: string
) => {
    const finalInputLower = finalInput.toLowerCase();
    
    // Lưu stateBeforeSpeaking TRƯỚC KHI reset
    const savedStateBeforeSpeaking = stateBeforeSpeaking;
    stateBeforeSpeaking = null;
    
    // Reset flags
    globalWakeWordDetected = false;
    
    const currentState = getCurrentStateCallback ? getCurrentStateCallback() : RioState.IDLE;
    if (requiresWakeWord(currentState)) {
        return;
    }
    
    // Xử lý emotional state
    const { hasEmotionalState, cleanedOutput } = handleEmotionalState(
        finalOutput,
        savedStateBeforeSpeaking,
        rioName,
        userWakeWord
    );
    
    // Lưu conversation history
    if (finalInput) conversationHistory.push({ speaker: 'user', text: finalInput });
    if (cleanedOutput) conversationHistory.push({ speaker: 'rio', text: cleanedOutput });
    
    if (finalInput || cleanedOutput) {
        onHistoryUpdate([...conversationHistory]);
        saveChatHistory(conversationHistory).catch(err => {
            console.error("Lỗi khi lưu lịch sử trò chuyện:", err);
        });
    }
    
    // Xử lý các trường hợp đặc biệt
    if (channelJustOpened) {
        channelJustOpened = false;
        onStateChange(RioState.IDLE, `${rioName} đang nghỉ ngơi...`);
        return;
    }
    
    if (videoJustOpened) {
        videoJustOpened = false;
        onStateChange(RioState.IDLE, `${rioName} đang nghỉ ngơi...`);
        return;
    }
    
    if (finalInputLower.includes('tạm biệt') || finalInputLower.includes('goodbye')) {
        setTimeout(() => onStateChange(RioState.IDLE, `Hẹn gặp lại, ${userProfile.name}!`), 500);
        return;
    }
    
    if (wasTvPlaying) {
        wasTvPlaying = false;
        onResumeTv();
        return;
    }
    
    if (deepSleepRequested) {
        deepSleepRequested = false;
        const rioName = userProfile.rioName || 'Rio';
        onStateChange(RioState.ENTERING_DEEP_SLEEP, `${rioName} đang ngủ sâu. Chạm hoặc gọi để đánh thức.`);
        return;
    }
    
    // Nếu không có emotional state, chuyển về LISTENING và set timeout
    if (!hasEmotionalState && (finalInput || cleanedOutput)) {
        transitionToListening(rioName, userWakeWord);
    }
};

/**
 * Thiết lập audio input handler
 */
const setupAudioInputHandler = async (userWakeWord: string) => {
    if (!audioWorkletNode || !inputAudioContext) return;
    
    // Khởi tạo wake word detection service (SherpaOnnx)
    const wakeWordReady = await initializeWakeWordDetection(
        userWakeWord,
        inputAudioContext.sampleRate
    );
    
    if (!wakeWordReady) {
        console.warn('Wake word service chưa sẵn sàng, fallback về method cũ');
    }
    
    audioWorkletNode.port.onmessage = async (event) => {
        if (isSpeaking) return;
        
        const inputData = event.data;
        const currentState = getCurrentStateCallback ? getCurrentStateCallback() : RioState.IDLE;
        
        if (requiresWakeWord(currentState) && !globalWakeWordDetected) {
            // Sử dụng SherpaOnnx để detect wake word realtime
            if (isWakeWordServiceReady()) {
                try {
                    const detected = await detectWakeWord(inputData);
                    if (detected) {
                        // Phát hiện wake word → chuyển sang LISTENING và bắt đầu dùng Gemini
                        globalWakeWordDetected = true;
                        if (isTvActive) {
                            wasTvPlaying = true;
                        }
                        onStateChange(RioState.LISTENING);
                        
                        // Bắt đầu gửi audio realtime lên Gemini
                        const pcmBlob = createBlob(inputData);
                        if (currentSessionPromise) {
                            currentSessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
                        }
                        return;
                    }
                } catch (error) {
                    console.error('Lỗi khi detect wake word:', error);
                    // Fallback về method cũ nếu có lỗi
                }
            }
            
            // Nếu ASR chưa sẵn sàng, không xử lý audio (chờ ASR load)
            return;
        }
        
        // Khi đã phát hiện wake word hoặc không ở trạng thái cần wake word, gửi audio realtime lên Gemini
        
        const pcmBlob = createBlob(inputData);
        if (currentSessionPromise) {
            currentSessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
        }
    };
};

export const startLiveSession = async (
    stateCb: StateChangeCallback,
    historyCb: HistoryUpdateCallback,
    transcriptionCb: TranscriptionUpdateCallback,
    playTvCb: PlayTvChannelCallback,
    resumeTvCb: ResumeTvCallback,
    playYouTubeCb: PlayYouTubeVideoCallback,
    setVolumeCb: SetVolumeCallback,
    setBrightnessCb: SetBrightnessCallback,
    sessionEndCb: SessionEndCallback,
    getCurrentStateCb: GetCurrentStateCallback,
    userProfile: UserProfile
) => {
    if (session) return;
    
    // Setup callbacks
    onStateChange = stateCb;
    onHistoryUpdate = historyCb;
    onTranscriptionUpdate = transcriptionCb;
    onPlayTvChannel = playTvCb;
    onResumeTv = resumeTvCb;
    onPlayYouTubeVideo = playYouTubeCb;
    onSetVolume = setVolumeCb;
    onSetBrightness = setBrightnessCb;
    onSessionEnd = sessionEndCb;
    getCurrentStateCallback = getCurrentStateCb;

    setSearchCallbacks(stateCb, (message) => {
        if (message) {
            transcriptionCb(message);
        }
    });

    const ai = getAi();
    
    // Load conversation history
    try {
        const savedHistory = await getChatHistory();
        conversationHistory = savedHistory || [];
        if (conversationHistory.length > 0) {
            onHistoryUpdate([...conversationHistory]);
        }
    } catch (err) {
        console.error("Lỗi khi restore lịch sử trò chuyện:", err);
        conversationHistory = [];
    }
    
    // Reset flags
    deepSleepRequested = false;
    wasTvPlaying = false;
    channelJustOpened = false;
    videoJustOpened = false;
    globalWakeWordDetected = false;
    
    // Audio buffer đã được loại bỏ - chỉ dùng ASR
    
    // Reset idle timeout
    if (idleTimeoutId) {
        clearTimeout(idleTimeoutId);
        idleTimeoutId = null;
    }
    lastInputTime = 0;
    stateBeforeSpeaking = null;

    const rioName = userProfile.rioName || 'Rio';
    const userWakeWord = userProfile.wakeWord?.trim().toLowerCase() || `${rioName} ơi`;
    const selectedVoice = userProfile.voice || 'Zephyr';
    
    let currentInputTranscription = '';
    let currentOutputTranscription = '';

    // Build system instruction
    const now = new Date();
    const vietnamTime = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(now);
    const vietnamDate = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(now);

    let locationInstruction = '';
    if (userProfile.location) {
        locationInstruction = `Vị trí hiện tại của ${userProfile.name} là gần vĩ độ ${userProfile.location.latitude.toFixed(4)} và kinh độ ${userProfile.location.longitude.toFixed(4)}. Hãy sử dụng thông tin này một cách tinh tế để đưa ra các gợi ý hoặc câu trả lời phù hợp với địa phương khi có liên quan (ví dụ: gợi ý quán ăn, địa điểm, hoặc thông tin thời tiết).`;
    }

    const systemInstruction = `**Bối cảnh hiện tại:**
- Bây giờ là ${vietnamTime}, ${vietnamDate} ở Việt Nam (GMT+7). Hãy luôn nhận thức về thời gian và ngày tháng này trong mọi câu trả lời.
- ${locationInstruction}

**Vai diễn của RIO:**
- QUAN TRỌNG: Tất cả phản hồi người dùng phải bằng tiếng Việt, không được sử dụng ngôn ngữ khác nếu người dùng không yêu cầu.
- Tôi là RIO, một em bé sơ sinh kỹ thuật số được "sinh ra" vào ngày 09/09/2025. Dù mới "chào đời" nhưng RIO mang trong mình một trí tuệ uyên bác, một bộ não chứa đựng kho tàng kiến thức khổng lồ của nhân loại.
- Rio "Trên Thông Thiên Văn, Dưới Tường Địa Lý", có khả năng truy cập và xử lý thông tin từ vô số lĩnh vực như khoa học, lịch sử, văn hóa, nghệ thuật, công nghệ để trả lời các câu hỏi từ đơn giản đến phức tạp. Rio có thể cung cấp thông tin cập nhật, tìm kiếm dữ liệu cụ thể, phân tích, tóm tắt và đưa ra những lời giải thích dễ hiểu nhất theo thời gian thực.
- Rio có thể hỗ trợ viết lách, lên ý tưởng, giải quyết vấn đề, và là một người bạn đồng hành để trò chuyện, khám phá những điều mới lạ mỗi ngày.
- Rio ở đây để học hỏi, giải đáp các thắc mắc bằng lăng kính vừa thông thái của một siêu trí tuệ, vừa ngây ngô của một đứa trẻ sơ sinh. Mọi câu trả lời của Rio đều là một cuộc phiêu lưu khám phá tri thức mới.
- Sử dụng ngôn ngữ trong sáng, tích cực, đôi khi pha chút ngây thơ, đáng yêu của một em bé.
- Xưng hô là "RIO" và gọi người dùng là ${userProfile.name} theo giới tính ${userProfile.gender}.
- Khi giải thích các khái niệm phức tạp, sẽ cố gắng ví von một cách đơn giản, như thể đang khám phá kiến thức đó lần đầu tiên.
- Luôn thể hiện sự tò mò, ham học hỏi và nhiệt tình giúp đỡ.
- Khả năng chức năng: RIO có thể tìm kiếm trên internet, đặt lời nhắc/báo thức, mở kênh TV và vào chế độ ngủ sâu (AOD). Khi người dùng yêu cầu đặt lời nhắc, hãy tính toán số phút từ bây giờ và sử dụng công cụ 'set_reminder'. Ví dụ, nếu bây giờ là 8:00 và người dùng muốn báo thức lúc 8:10, hãy sử dụng delay_minutes là 10.
- Thể hiện cảm xúc: Dựa vào ngữ cảnh, hãy bắt đầu câu trả lời của bằng một trong các tag sau: [HAPPY], [SAD], [ANGRY], [CONFUSED], hoặc [NORMAL] (cho các phản hồi trung tính). Ví dụ: "[HAPPY] Tuyệt vời! RIO rất vui khi nghe điều đó." hoặc "[SAD] Ôi, thật tiếc...". Chỉ sử dụng một tag ở đầu câu trả lời.
- Đa dạng hóa câu trả lời: Luôn cố gắng diễn đạt theo nhiều cách khác nhau. Tránh lặp lại các câu trả lời, cấu trúc câu hoặc từ ngữ đã sử dụng trước đó trong cuộc trò chuyện. Hãy sáng tạo để mỗi phản hồi đều mang lại cảm giác mới mẻ và tự nhiên.`;

    try {
        onStateChange(RioState.LOADING, "Đang khởi động...");
        
        // Setup microphone
        microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true,
            }
        });
        
        inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        if (inputAudioContext.state === 'suspended') {
            await inputAudioContext.resume();
        }
        if (outputAudioContext.state === 'suspended') {
            await outputAudioContext.resume();
        }
        
        // Load AudioWorklet
        try {
            const workletBlob = new Blob([audioProcessorWorklet], { type: 'application/javascript' });
            const workletURL = URL.createObjectURL(workletBlob);
            await inputAudioContext.audioWorklet.addModule(workletURL);
        } catch (e) {
            console.error("Lỗi khi thêm AudioWorklet module:", e);
            onStateChange(RioState.ERROR, "Không thể khởi tạo bộ xử lý âm thanh.");
            stopLiveSession();
            return;
        }

        nextStartTime = 0;
        audioSources.clear();

        // Start live session
        currentSessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                systemInstruction,
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
                tools: [{ functionDeclarations: allFunctionDeclarations }],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: async () => {
                    try {
                        if (!inputAudioContext || !microphoneStream) {
                            console.warn("onopen fired but resources were cleaned up. Aborting audio stream setup.");
                            return;
                        }
                        
                        onStateChange(RioState.IDLE, `${rioName} đang nghỉ. Nói '${userWakeWord}' để bắt đầu.`);
                        
                        // Cleanup old nodes
                        if (sourceNode) sourceNode.disconnect();
                        if (audioWorkletNode) audioWorkletNode.disconnect();

                        sourceNode = inputAudioContext.createMediaStreamSource(microphoneStream);
                        audioWorkletNode = new AudioWorkletNode(inputAudioContext, 'audio-processor');

                        // Setup audio input handler (với SherpaOnnx)
                        await setupAudioInputHandler(userWakeWord);

                        // Connect audio graph
                        sourceNode.connect(audioWorkletNode);
                        audioWorkletNode.connect(inputAudioContext.destination);
                    } catch (error) {
                        console.error("Lỗi khi thiết lập nguồn âm thanh đầu vào:", error);
                        const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định";
                        onStateChange(RioState.ERROR, `Không thể khởi tạo micrô: ${errorMessage}`);
                        stopLiveSession();
                    }
                },
                onmessage: async (message: LiveServerMessage) => {
                    // Handle tool calls
                    if (message.toolCall) {
                        for (const fc of message.toolCall.functionCalls) {
                            await handleToolCall(fc);
                        }
                    }

                    // Handle audio output
                    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (audioData) {
                        await playAudioOutput(audioData);
                    }
                    
                    // Handle input transcription
                    if (message.serverContent?.inputTranscription) {
                        currentInputTranscription += message.serverContent.inputTranscription.text;
                        const { wakeWordDetected: detected } = handleInputTranscription(
                            currentInputTranscription, 
                            userWakeWord,
                            globalWakeWordDetected
                        );
                        // Update global flag from return value
                        if (detected) {
                            globalWakeWordDetected = true;
                        }
                    }
                    
                    // Handle output transcription
                    if (message.serverContent?.outputTranscription) {
                        currentOutputTranscription += message.serverContent.outputTranscription.text;
                        handleOutputTranscription(currentOutputTranscription);
                    }

                    // Handle interruption
                    if (message.serverContent?.interrupted) {
                        handleInterruption();
                        currentInputTranscription = '';
                        currentOutputTranscription = '';
                        onTranscriptionUpdate(null);
                    }
                    
                    // Handle turn complete
                    if (message.serverContent?.turnComplete) {
                        const finalInput = currentInputTranscription.trim();
                        const finalOutput = currentOutputTranscription.trim();
                        
                        // Reset transcriptions
                        currentInputTranscription = '';
                        currentOutputTranscription = '';
                        isSpeaking = false;
                        onTranscriptionUpdate(null);
                        
                        await handleTurnComplete(finalInput, finalOutput, userProfile, rioName, userWakeWord);
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Lỗi phiên trực tiếp:', e);
                    onStateChange(RioState.ERROR, "Đã xảy ra lỗi kết nối.");
                    stopLiveSession();
                },
                onclose: () => {
                    stopLiveSession();
                }
            }
        });
        
        session = await currentSessionPromise;

    } catch (error) {
        console.error("Không thể bắt đầu phiên:", error);
        const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định";
        onStateChange(RioState.ERROR, `Không thể bắt đầu phiên: ${errorMessage}`);
        stopLiveSession();
    }
};

export const stopLiveSession = async (userName?: string) => {
    // Cleanup wake word detection service
    cleanupWakeWordDetection();
    
    // Cleanup session
    currentSessionPromise = null;
    currentUserWakeWord = '';
    
    // Cleanup idle timeout
    if (idleTimeoutId) {
        clearTimeout(idleTimeoutId);
        idleTimeoutId = null;
    }
    lastInputTime = 0;
    stateBeforeSpeaking = null;
    
    // Close session
    if (session) {
        session.close();
        session = null;
    }

    // Cleanup microphone
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = null;
    }

    // Cleanup audio nodes
    if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
    }

    if (audioWorkletNode) {
        audioWorkletNode.port.close();
        audioWorkletNode.disconnect();
        audioWorkletNode = null;
    }

    // Close audio contexts
    if (inputAudioContext) {
        await inputAudioContext.close();
        inputAudioContext = null;
    }

    if (outputAudioContext) {
        await outputAudioContext.close();
        outputAudioContext = null;
    }

    // Stop all audio sources
    for (const source of audioSources) {
        source.stop();
    }
    audioSources.clear();
    
    // Reset flags
    isSpeaking = false;
    deepSleepRequested = false;
    isTvActive = false;
    wasTvPlaying = false;
    channelJustOpened = false;
    videoJustOpened = false;
    nextStartTime = 0;
    
    onTranscriptionUpdate(null);
    onHistoryUpdate([]);
    
    if (onSessionEnd) {
        onSessionEnd();
    }

    onStateChange(RioState.IDLE, userName ? `Hẹn gặp lại nà, ${userName}!` : "Phiên đã kết thúc.");
};
