// Các function declarations cho Gemini AI tools
import { FunctionDeclaration, Type } from "@google/genai";

export const getInformationFromWebFunction: FunctionDeclaration = {
    name: 'get_information_from_web',
    description: 'Tìm kiếm trên internet để lấy thông tin khi bạn không biết câu trả lời. Sử dụng cho các sự kiện gần đây, tin tức, hoặc các truy vấn cụ thể, thực tế.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: {
                type: Type.STRING,
                description: 'Truy vấn tìm kiếm hoặc chủ đề để tra cứu.'
            }
        },
        required: ['query']
    }
};

export const setReminderFunction: FunctionDeclaration = {
    name: 'set_reminder',
    description: 'Đặt báo thức hoặc lời nhắc cho một thời điểm trong tương lai. Tính toán thời gian từ bây giờ đến lúc đó bằng phút.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            delay_minutes: {
                type: Type.NUMBER,
                description: 'Số phút kể từ bây giờ cho đến khi báo thức hoặc lời nhắc vang lên.'
            },
            label: {
                type: Type.STRING,
                description: 'Nội dung của lời nhắc hoặc báo thức. Ví dụ: "Thức dậy" hoặc "Gọi cho mẹ".'
            }
        },
        required: ['delay_minutes', 'label']
    }
};

export const enterDeepSleepFunction: FunctionDeclaration = {
    name: 'enter_deep_sleep',
    description: 'Vào chế độ ngủ sâu (tiết kiệm pin, AOD) khi người dùng yêu cầu. Chỉ sử dụng khi người dùng nói rõ ràng các cụm từ như "ngủ sâu", "chế độ tiết kiệm pin", "chế độ AOD", hoặc "tắt màn hình".',
    parameters: {
        type: Type.OBJECT,
        properties: {},
    }
};

export const openTvChannelFunction: FunctionDeclaration = {
    name: 'open_tv_channel',
    description: 'Mở một kênh truyền hình trực tiếp khi người dùng yêu cầu xem TV. Sử dụng tên kênh mà người dùng cung cấp.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            channel_name: {
                type: Type.STRING,
                description: 'Tên của kênh TV cần mở. Ví dụ: "VTV1", "HTV7".'
            }
        },
        required: ['channel_name']
    }
};

export const playYouTubeVideoFunction: FunctionDeclaration = {
    name: 'play_youtube_video',
    description: 'Tìm kiếm và phát một video trên YouTube. Sử dụng chức năng này khi người dùng yêu cầu nghe một bài hát, xem một video cụ thể, hoặc tìm kiếm nội dung trên YouTube.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: {
                type: Type.STRING,
                description: 'Tên bài hát, nghệ sĩ, hoặc tiêu đề video để tìm kiếm. Ví dụ: "bài hát pop mới nhất" hoặc "video mèo hài hước".'
            }
        },
        required: ['query']
    }
};

export const setVolumeFunction: FunctionDeclaration = {
    name: 'set_volume',
    description: 'Điều chỉnh âm lượng của video hoặc TV đang phát. Mức âm lượng từ 0 (tắt tiếng) đến 100 (tối đa).',
    parameters: {
        type: Type.OBJECT,
        properties: {
            level: {
                type: Type.NUMBER,
                description: 'Mức âm lượng mong muốn, từ 0 đến 100.'
            }
        },
        required: ['level']
    }
};

export const setScreenBrightnessFunction: FunctionDeclaration = {
    name: 'set_screen_brightness',
    description: 'Điều chỉnh độ sáng của màn hình ứng dụng. Mức độ sáng từ 0 (tối nhất) đến 100 (sáng nhất).',
    parameters: {
        type: Type.OBJECT,
        properties: {
            level: {
                type: Type.NUMBER,
                description: 'Mức độ sáng mong muốn, từ 0 đến 100.'
            }
        },
        required: ['level']
    }
};

// Export tất cả functions để dễ import
export const allFunctionDeclarations = [
    getInformationFromWebFunction,
    setReminderFunction,
    enterDeepSleepFunction,
    openTvChannelFunction,
    playYouTubeVideoFunction,
    setVolumeFunction,
    setScreenBrightnessFunction
];

