export enum RioState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  LOADING = 'LOADING',
  ERROR = 'ERROR',
  ENTERING_DEEP_SLEEP = 'ENTERING_DEEP_SLEEP',
  ALARM_RINGING = 'ALARM_RINGING',
  HAPPY = 'HAPPY',
  SAD = 'SAD',
  ANGRY = 'ANGRY',
  CONFUSED = 'CONFUSED',
}

export enum IdleExpression {
  NORMAL,
  BLINK,
  LOOK_LEFT,
  LOOK_RIGHT,
  HAPPY,
  SAD,
  SURPRISED,
  SQUINT,
  WINK_LEFT,
  LOVE,
  DIZZY,
  ANGRY,
  CONFUSED,
  SLEEPY,
  PROUD,
  KAWAII,
  SLEEPING,
}

// Thêm mới: Định nghĩa cấu trúc cho cài đặt nền
export interface BackgroundSettings {
  type: 'gradient' | 'image';
  value: string; // Tên class CSS cho gradient, hoặc chuỗi base64 cho ảnh
  overlay?: number; // Độ mờ cho ảnh nền, từ 0 đến 1
  size?: 'cover' | 'contain' | 'repeat'; // Kích thước ảnh nền
}


export interface UserProfile {
  name: string;
  gender: string;
  rioName?: string;
  wakeWord?: string;
  voice?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  // Thêm mới: Thêm thuộc tính backgroundSettings vào UserProfile
  backgroundSettings?: BackgroundSettings;
}

export interface ChatMessage {
  speaker: 'user' | 'rio';
  text: string;
}

export interface IPTVChannel {
  name:string;
  logo: string;
  url: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
}