// Service xử lý wake word detection sử dụng SherpaOnnx
// Hoạt động offline, realtime, không cần internet
// Wake word: "rio rio" (tiếng Anh)

// Global state
let isInitialized = false;
let wakeWordPattern: string = '';
let sampleRate: number = 16000;
let sherpaOnnxModule: any = null;
let keywordSpotter: any = null;
let recognizerStream: any = null; // Giữ stream instance để không tạo mới mỗi lần

/**
 * Đợi SherpaOnnx WASM module load xong từ script tags trong HTML
 * Files được load bằng <script> tags trong index.html
 */
const waitForSherpaOnnxReady = async (): Promise<any> => {
    return new Promise((resolve, reject) => {
        // Config Module.locateFile để WASM tìm đúng files
        // @ts-ignore
        if (typeof window !== 'undefined' && window.Module) {
            // @ts-ignore
            if (!window.Module.locateFile) {
                // @ts-ignore
                window.Module.locateFile = function(path: string, scriptDirectory: string = '') {
                    // Model files từ .data sẽ được extract, path sẽ là relative
                    // Nếu là .wasm hoặc .data, tìm trong /sherpa-onnx/wasm/
                    if (path.endsWith('.wasm') || path.endsWith('.data')) {
                        return '/sherpa-onnx/wasm/' + path;
                    }
                    // Model files (encoder.onnx, etc.) sẽ được extract từ .data
                    // Path tương đối từ WASM file location
                    return scriptDirectory + path;
                };
            }
        }
        
        // Kiểm tra xem đã load chưa
        // @ts-ignore
        if (typeof window !== 'undefined' && window.Module && window.Module.HEAP8) {
            // @ts-ignore
            if (window.createOnlineRecognizer) {
                // @ts-ignore
                resolve(window);
                return;
            }
        }
        
        // Đợi Module.onRuntimeInitialized
        let timeoutId: number | null = null;
        let checkCount = 0;
        const maxChecks = 100; // 10 giây (100 * 100ms) - cần thời gian để load .data file
        
        const checkReady = () => {
            checkCount++;
            
            // @ts-ignore
            if (typeof window !== 'undefined' && window.Module && window.Module.HEAP8) {
                // @ts-ignore
                if (window.createOnlineRecognizer) {
                    if (timeoutId) clearTimeout(timeoutId);
                    // @ts-ignore
                    resolve(window);
                    return;
                }
            }
            
            if (checkCount >= maxChecks) {
                if (timeoutId) clearTimeout(timeoutId);
                reject(new Error('Timeout: SherpaOnnx WASM module không load được sau 10 giây. Kiểm tra lại files trong public/sherpa-onnx/wasm/'));
                return;
            }
            
            timeoutId = window.setTimeout(checkReady, 100);
        };
        
        // Setup onRuntimeInitialized callback
        // @ts-ignore
        if (typeof window !== 'undefined' && window.Module) {
            // @ts-ignore
            const originalCallback = window.Module.onRuntimeInitialized;
            // @ts-ignore
            window.Module.onRuntimeInitialized = () => {
                console.log('✅ SherpaOnnx WASM runtime đã được khởi tạo');
                if (originalCallback) originalCallback();
                // Đợi thêm một chút để .data file được extract xong
                setTimeout(checkReady, 500);
            };
        }
        
        // Bắt đầu check
        checkReady();
    });
};

/**
 * Khởi tạo ASR Recognizer (dùng ASR model để detect wake word "rio rio")
 * Model files nằm trong .data file, được load tự động
 * Files được load bằng <script> tags trong index.html
 */
const initializeASRRecognizer = async (
    wakeWord: string
): Promise<any> => {
    try {
        // Đợi WASM module load xong từ script tags
        if (!sherpaOnnxModule) {
            console.log('⏳ Đang đợi SherpaOnnx WASM module load...');
            sherpaOnnxModule = await waitForSherpaOnnxReady();
            console.log('✅ SherpaOnnx WASM module đã sẵn sàng');
        }
        
        // Kiểm tra xem createOnlineRecognizer có sẵn không
        // @ts-ignore
        if (!sherpaOnnxModule.createOnlineRecognizer) {
            throw new Error('createOnlineRecognizer không tìm thấy. Đảm bảo đã load sherpa-onnx-asr.js trong index.html');
        }
        
        // @ts-ignore
        const Module = sherpaOnnxModule.Module || window.Module;
        
        // @ts-ignore
        if (!Module || !Module.HEAP8) {
            throw new Error('Module chưa được khởi tạo. Đợi Module.onRuntimeInitialized');
        }
        
        // Đợi thêm một chút để đảm bảo .data file đã được extract xong
        // Model files (encoder.onnx, decoder.onnx, joiner.onnx, tokens.txt) 
        // sẽ được extract từ .data vào virtual file system
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Model files nằm trong .data file, được load tự động
        // createOnlineRecognizer sẽ tìm files với path "./encoder.onnx" 
        // Emscripten sẽ resolve path này từ virtual file system
        // @ts-ignore
        const recognizer = sherpaOnnxModule.createOnlineRecognizer(Module);
        
        if (!recognizer) {
            throw new Error('Không thể tạo recognizer. Kiểm tra lại model files trong .data');
        }
        
        // Tạo stream instance một lần để dùng lại
        if (recognizer.createStream) {
            recognizerStream = recognizer.createStream();
        } else if (recognizer.createOnlineStream) {
            recognizerStream = recognizer.createOnlineStream();
        }
        
        console.log('✅ ASR Recognizer đã được khởi tạo');
        return recognizer;
    } catch (error) {
        console.error('❌ Lỗi khi khởi tạo ASR Recognizer:', error);
        throw error;
    }
};

/**
 * Khởi tạo wake word detection service
 */
export const initializeWakeWordDetection = async (
    wakeWord: string,
    sampleRateParam: number = 16000
): Promise<boolean> => {
    try {
        wakeWordPattern = wakeWord.toLowerCase().trim();
        sampleRate = sampleRateParam;
        
        console.log(`🔄 Đang khởi tạo wake word detection với từ khóa: "${wakeWordPattern}"`);
        
        // Khởi tạo ASR Recognizer (dùng ASR để transcribe và check wake word)
        keywordSpotter = await initializeASRRecognizer(wakeWordPattern);
        
        if (!keywordSpotter) {
            console.warn('⚠️ Không thể khởi tạo ASR Recognizer, sẽ fallback về method cũ');
            isInitialized = false;
            return false;
        }
        
        isInitialized = true;
        console.log(`✅ Wake word detection đã được khởi tạo với từ khóa: "${wakeWordPattern}"`);
        console.log(`📦 Sử dụng ASR model để detect wake word (realtime transcription)`);
        return true;
    } catch (error) {
        console.error('❌ Lỗi khi khởi tạo wake word detection:', error);
        console.warn('⚠️ Sẽ fallback về method cũ (buffer + Gemini)');
        isInitialized = false;
        keywordSpotter = null;
        return false;
    }
};

/**
 * Xử lý audio chunk và kiểm tra wake word
 * @param audioData Float32Array audio data (16kHz, mono)
 * @returns boolean - true nếu phát hiện wake word
 */
export const processAudioChunk = async (audioData: Float32Array): Promise<boolean> => {
    if (!isInitialized || !keywordSpotter || !audioData || audioData.length === 0) {
        return false;
    }
    
    try {
        // Convert Float32Array về format mà SherpaOnnx cần
        const audioArray = new Float32Array(audioData);
        
        // Đảm bảo stream đã được tạo
        if (!recognizerStream) {
            if (keywordSpotter.createStream) {
                recognizerStream = keywordSpotter.createStream();
            } else if (keywordSpotter.createOnlineStream) {
                recognizerStream = keywordSpotter.createOnlineStream();
            } else {
                console.warn('⚠️ Recognizer không có createStream method');
                return false;
            }
        }
        
        // Feed audio vào stream
        if (recognizerStream.acceptWaveform) {
            recognizerStream.acceptWaveform(sampleRate, audioArray);
        } else {
            console.warn('⚠️ Stream không có acceptWaveform method');
            return false;
        }
        
        // Decode để nhận kết quả (chỉ khi có đủ data)
        // API: recognizer.isReady(stream), recognizer.decode(stream), recognizer.getResult(stream)
        if (keywordSpotter.isReady && keywordSpotter.isReady(recognizerStream)) {
            keywordSpotter.decode(recognizerStream);
            const result = keywordSpotter.getResult(recognizerStream);
            
            if (result && result.text) {
                const text = result.text.toLowerCase().trim();
                
                // Check xem có chứa wake word không
                if (text.includes(wakeWordPattern)) {
                    console.log(`🎯 ASR phát hiện wake word trong: "${text}"`);
                    // Reset stream để tiếp tục detect
                    if (recognizerStream.reset) {
                        recognizerStream.reset();
                    } else if (keywordSpotter.reset) {
                        keywordSpotter.reset(recognizerStream);
                    }
                    return true;
                }
            }
        }
        
        return false; // Chưa phát hiện, không reset stream để tiếp tục tích lũy audio
    } catch (error) {
        console.error('❌ Lỗi khi process audio chunk với ASR:', error);
        // Reset stream nếu có lỗi
        if (recognizerStream && recognizerStream.reset) {
            recognizerStream.reset();
        }
        return false;
    }
};

/**
 * Xử lý audio stream realtime
 * @param audioBuffer Float32Array audio buffer
 * @returns Promise<boolean> - true nếu phát hiện wake word
 */
export const detectWakeWord = async (audioBuffer: Float32Array): Promise<boolean> => {
    if (!isInitialized) {
        return false;
    }
    
    return await processAudioChunk(audioBuffer);
};

/**
 * Dọn dẹp resources
 */
export const cleanupWakeWordDetection = () => {
    if (recognizerStream) {
        if (recognizerStream.reset) {
            recognizerStream.reset();
        }
        recognizerStream = null;
    }
    
    if (keywordSpotter) {
        if (keywordSpotter.reset) {
            keywordSpotter.reset();
        }
        if (keywordSpotter.delete) {
            keywordSpotter.delete();
        }
        keywordSpotter = null;
    }
    
    sherpaOnnxModule = null;
    isInitialized = false;
    wakeWordPattern = '';
};

/**
 * Kiểm tra xem service đã được khởi tạo chưa
 */
export const isWakeWordServiceReady = (): boolean => {
    return isInitialized && keywordSpotter !== null;
};
