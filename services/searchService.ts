// Dịch vụ tìm kiếm: Google Search và YouTube Search
import { RioState } from '../types';
import { getAi } from './geminiService';

// Callback để cập nhật state khi tìm kiếm
type StateChangeCallback = (state: RioState, status?: string) => void;
type TranscriptionUpdateCallback = (message: { speaker: 'rio', text: string } | null) => void;

let onStateChange: StateChangeCallback = () => {};
let onTranscriptionUpdate: TranscriptionUpdateCallback = () => {};

// Hàm để set callbacks (sẽ được gọi từ liveSessionService)
export const setSearchCallbacks = (
    stateCb: StateChangeCallback,
    transcriptionCb: TranscriptionUpdateCallback
) => {
    onStateChange = stateCb;
    onTranscriptionUpdate = transcriptionCb;
};

export const performGoogleSearch = async (query: string, onStreamUpdate: (text: string) => void): Promise<string> => {
    onStateChange(RioState.THINKING, `Đang tìm kiếm "${query}"...`);

    const now = new Date();
    const vietnamTime = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(now);

    const prompt = `Bây giờ là ${vietnamTime} ở Việt Nam (GMT+7). Dựa trên thời gian này, hãy tổng hợp câu trả lời thực tế cho truy vấn sau đây từ internet. Trả lời trực tiếp và chỉ cung cấp thông tin bạn tìm thấy, không thêm bất kỳ lời thoại nào. Truy vấn: "${query}"`;

    let fullText = '';
    try {
        const ai = await getAi();
        const response = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        for await (const chunk of response) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                onStreamUpdate(fullText);
            }
        }
        
        return fullText.trim() || "Rất tiếc, tôi không thể tìm thấy thông tin vào lúc này.";
    } catch (error) {
        console.error('Tìm kiếm Google thất bại:', error);
        const errorMessage = "Tôi gặp sự cố khi tìm kiếm thông tin về điều đó ngay bây giờ.";
        onStreamUpdate(errorMessage);
        return errorMessage;
    }
};

export const findYouTubeVideo = async (query: string): Promise<{id: string, title: string} | null> => {
    onStateChange(RioState.THINKING, `Đang tìm "${query}" trên YouTube...`);
    const prompt = `Nhiệm vụ của bạn là tìm một video trên YouTube và trả về ID cùng tiêu đề của nó.

**YÊU CẦU TUYỆT ĐỐI:** Toàn bộ phản hồi của bạn **BẮT BUỘC** phải là một đối tượng JSON duy nhất và không được chứa bất kỳ văn bản, lời giải thích, hay lời xin lỗi nào khác bên ngoài đối tượng JSON đó.

**Truy vấn của người dùng:** "${query}"

**Quy trình:**
1.  **Phân tích truy vấn:**
    *   Nếu truy vấn là một bài hát hoặc video cụ thể, hãy tìm chính xác video đó.
    *   Nếu truy vấn là một chủ đề hoặc thể loại chung chung (ví dụ: 'nhạc buồn', 'nhạc chill', 'video hài hước'), hãy **tinh chỉnh truy vấn tìm kiếm của bạn** để tìm các danh sách phát (playlist) hoặc video tổng hợp. Ví dụ, tìm kiếm "tuyển tập nhạc buồn" hoặc "playlist video hài hước".
2.  **Tìm kiếm thông minh:** Tìm kiếm trên YouTube cho truy vấn đã được tinh chỉnh (nếu cần). Ưu tiên các phiên bản "lyric video" hoặc "audio" vì chúng ít bị chặn nhúng hơn các video ca nhạc chính thức (Official Music Video).
3.  **Trích xuất thông tin:** Từ liên kết video phù hợp nhất bạn tìm thấy, trích xuất ID video và tiêu đề đầy đủ.
    *   ID video là chuỗi ký tự sau \`watch?v=\`, \`/shorts/\`, hoặc \`youtu.be/\`.
4.  **Định dạng đầu ra:**
    *   **Nếu tìm thấy video:** Phản hồi của bạn chỉ được là: \`{"id": "VIDEO_ID_HERE", "title": "VIDEO_TITLE_HERE"}\`
    *   **Nếu không tìm thấy video:** Phản hồi của bạn chỉ được là: \`{"id": null, "title": null}\`

**KHÔNG ĐƯỢC PHÉP** thêm bất kỳ văn bản nào khác. Ví dụ, nếu bạn không tìm thấy video, đừng giải thích lý do, chỉ cần trả về \`{"id": null, "title": null}\`.`;
    
    let responseText = '';

    try {
        const ai = await getAi();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        
        responseText = response.text?.trim() ?? '';
        if (!responseText) {
             console.error('Lỗi tìm kiếm YouTube: Phản hồi trống.');
             return null;
        }

        // --- Robust JSON Extraction ---
        // Find the first '{' and the last '}' to extract the JSON object,
        // ignoring any explanatory text from the AI.
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}');

        if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
            // If no valid JSON structure is found, log the response and return null.
            console.error(`Không tìm thấy JSON hợp lệ trong phản hồi. Phản hồi nhận được: "${responseText}"`);
            return null;
        }

        const jsonString = responseText.substring(jsonStart, jsonEnd + 1);
        const data = JSON.parse(jsonString);

        if (data && typeof data.id === 'string' && typeof data.title === 'string') {
            return { id: data.id, title: data.title };
        }
        
        // This case handles `{"id": null, "title": null}`
        if (data && data.id === null) {
            console.log(`Không tìm thấy video nào cho truy vấn: "${query}"`);
            return null;
        }

        // Handle cases where the structure is valid JSON but the content is not as expected.
        console.error(`Dữ liệu JSON không hợp lệ. Phản hồi nhận được: "${responseText}"`);
        return null;

    } catch (error) {
        console.error(`Lỗi tìm kiếm YouTube (có thể do JSON không hợp lệ):`, error, `Phản hồi nhận được: "${responseText}"`);
        return null;
    }
};

