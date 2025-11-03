// Dịch vụ lấy thông tin thời tiết với caching
import { getAi } from './geminiService';

export interface WeatherData {
    temperature: number;
    condition: string;
    emoji: string;
}

// Service-level caching
interface CacheEntry<T> {
    data: T;
    expiry: number;
}
let weatherCache: CacheEntry<WeatherData> | null = null;

const WEATHER_CACHE_DURATION = 1000 * 60 * 30; // 30 phút

export const getWeatherForLocation = async (latitude: number, longitude: number): Promise<WeatherData> => {
    // Return from cache if valid
    if (weatherCache && Date.now() < weatherCache.expiry) {
        return weatherCache.data;
    }
    
    try {
        const ai = getAi();
        const prompt = `Nhiệm vụ của bạn là tìm thời tiết hiện tại cho một vị trí cụ thể bằng cách tìm kiếm trên internet. TOÀN BỘ câu trả lời của bạn BẮT BUỘC phải ở định dạng: TEMPERATURE;CONDITION;EMOJI.
- TEMPERATURE là nhiệt độ theo độ C, dưới dạng số.
- CONDITION là mô tả ngắn gọn bằng tiếng Việt (ví dụ: 'Nắng', 'Mây rải rác', 'Mưa rào').
- EMOJI là một emoji duy nhất đại diện cho điều kiện thời tiết.
Ví dụ: 28;Nắng;☀️

Nếu bạn HOÀN TOÀN KHÔNG THỂ tìm thấy thời tiết cho tọa độ đã cho sau khi tìm kiếm, bạn BẮT BUỘC phải trả lời bằng: NULL;Không thể xác định;❓

Không được thêm bất kỳ từ ngữ, lời giải thích hay lời xin lỗi nào khác. Câu trả lời của bạn phải tuân thủ nghiêm ngặt định dạng này.
Tọa độ: Vĩ độ ${latitude}, Kinh độ ${longitude}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        
        const responseText = response.text.trim();
        const parts = responseText.split(';');
        
        if (parts.length !== 3) {
            throw new Error(`Định dạng thời tiết không mong đợi: ${responseText}`);
        }
        
        if (parts[0].toUpperCase() === 'NULL') {
            throw new Error(`Không thể tìm thấy dữ liệu thời tiết cho vị trí này.`);
        }

        const temperature = parseFloat(parts[0]);
        const condition = parts[1].trim();
        const emoji = parts[2].trim();

        if (isNaN(temperature) || !condition || !emoji) {
            throw new Error(`Dữ liệu thời tiết trả về không hợp lệ: ${responseText}`);
        }
        
        const result = { temperature, condition, emoji };
        
        // Update cache
        weatherCache = { data: result, expiry: Date.now() + WEATHER_CACHE_DURATION };
        return result;

    } catch (error) {
        if (error instanceof Error && (error.message.includes('Định dạng thời tiết không mong đợi') || error.message.includes('Dữ liệu thời tiết trả về không hợp lệ'))) {
             console.error("Lỗi phân tích cú pháp thời tiết:", error.message);
             throw new Error("Rất tiếc, Rio không thể đọc được dự báo thời tiết lúc này.");
        }
        
        if (error instanceof Error) {
             console.error("Lỗi lấy dữ liệu thời tiết:", error);
             throw error;
        }

        console.error("Lỗi thời tiết không xác định:", error);
        throw new Error("Không thể lấy dữ liệu thời tiết ngay bây giờ.");
    }
};

