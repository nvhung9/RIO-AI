import React, { useState } from 'react';
import { UserProfile } from '../types';
import * as geminiService from '../services/geminiService';

interface UserInfoFormProps {
    onSubmit: (profile: UserProfile) => void;
}

// Thêm mới: Các icon để giao diện trực quan hơn
const SpeakerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
    </svg>
);

const SpinnerIcon = () => (
     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


export const UserInfoForm: React.FC<UserInfoFormProps> = ({ onSubmit }) => {
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');
    const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
    const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    
    // Thêm mới: State để quản lý giọng nói và trạng thái nút test.
    const [voice, setVoice] = useState('Zephyr'); 
    const [isTestingVoice, setIsTestingVoice] = useState(false);

    const handleLocationRequest = () => {
        if (!navigator.geolocation) {
            setLocationStatus('denied');
            return;
        }
        setLocationStatus('requesting');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
                setLocationStatus('granted');
            },
            () => {
                setLocationStatus('denied');
            }
        );
    };

    // Thêm mới: Hàm xử lý khi người dùng nhấn nút "Nghe thử".
    const handleTestVoice = async () => {
        setIsTestingVoice(true);
        try {
            await geminiService.textToSpeechTest(voice);
        } catch (error) {
            alert((error as Error).message);
        } finally {
            setIsTestingVoice(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && gender) {
            const defaultRioName = 'Rio';
            const profile: UserProfile = { 
                name: name.trim(), 
                gender,
                rioName: defaultRioName,
                wakeWord: `${defaultRioName}`,
                // Thêm mới: Gán giọng nói đã chọn vào hồ sơ người dùng.
                voice: voice,
            };
            if (location) {
                profile.location = location;
            }
            onSubmit(profile);
        }
    };

    const isFormValid = name.trim() !== '' && gender !== '';

    const locationButtonContent = () => {
        switch (locationStatus) {
            case 'requesting':
                return (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Đang lấy vị trí...
                    </>
                );
            case 'granted':
                return '✅ Đã cấp quyền truy cập';
            case 'denied':
                return '❌ Không thể truy cập vị trí';
            case 'idle':
            default:
                return 'Chia sẻ vị trí';
        }
    };

    return (
        // Cập nhật: Thay đổi nền chung để hiệu ứng liquid glass nổi bật hơn
        <div className="flex flex-col items-center justify-center min-h-screen font-sans p-4 text-white">
            {/* Cập nhật: Áp dụng hiệu ứng liquid glass cho form */}
            <div className="w-full max-w-sm p-8 space-y-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-lg">
                <div className="text-center">
                    <h1 className="text-3xl font-bold">Chào Mừng Bạn Đến Với Rio</h1>
                    <p className="mt-2 text-gray-300">Hãy giới thiệu một chút về bạn.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-300">
                            Tên của bạn
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            // Cập nhật: Style cho input để phù hợp với hiệu ứng glass
                            className="w-full px-3 py-2 text-white bg-black/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="Ví dụ: An"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-3 text-sm font-medium text-gray-300">Giới tính của bạn</label>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                           {['Nam', 'Nữ', 'Khác'].map((option) => (
                                <label key={option} className="flex-grow">
                                    <input
                                        type="radio"
                                        name="gender"
                                        value={option}
                                        checked={gender === option}
                                        onChange={(e) => setGender(e.target.value)}
                                        className="sr-only peer"
                                    />
                                     {/* Cập nhật: Style cho nút radio để phù hợp với hiệu ứng glass */}
                                    <div className="w-full py-2 px-4 text-center text-gray-300 bg-black/20 border-2 border-white/30 rounded-lg cursor-pointer peer-checked:bg-blue-600 peer-checked:border-blue-500 peer-checked:text-white transition-colors">
                                        {option}
                                    </div>
                                </label>
                           ))}
                        </div>
                    </div>

                    {/* Thêm mới: Giao diện chọn giọng nói */}
                    <div>
                        <label htmlFor="rioVoice" className="block mb-2 text-sm font-medium text-gray-300">Chọn giọng nói cho Rio</label>
                        <div className="flex items-center gap-2">
                            <select
                                id="rioVoice"
                                value={voice}
                                onChange={(e) => setVoice(e.target.value)}
                                // Cập nhật: Style cho select để phù hợp với hiệu ứng glass
                                className="flex-grow w-full px-3 py-2 text-white bg-black/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                            >
                                {geminiService.availableVoices.map((v) => (
                                    <option key={v.id} value={v.id} className="bg-gray-800">{v.name}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleTestVoice}
                                disabled={isTestingVoice}
                                // Cập nhật: Style cho button để phù hợp với hiệu ứng glass
                                className="p-3 bg-black/20 border border-white/30 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-wait"
                                aria-label="Nghe thử giọng nói"
                            >
                                {isTestingVoice ? <SpinnerIcon /> : <SpeakerIcon />}
                            </button>
                        </div>
                    </div>


                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-300">Dự báo thời tiết (Tùy chọn)</label>
                        <p className="text-xs text-gray-400 mb-3">Chia sẻ vị trí để Rio có thể cung cấp dự báo thời tiết chính xác.</p>
                        <button 
                            type="button" 
                            onClick={handleLocationRequest} 
                            disabled={locationStatus === 'requesting' || locationStatus === 'granted'}
                            // Cập nhật: Style cho button để phù hợp với hiệu ứng glass
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-white bg-black/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-white/20"
                        >
                            {locationButtonContent()}
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={!isFormValid}
                        className={`w-full px-5 py-3 text-base font-medium text-center text-white rounded-lg focus:ring-4 focus:outline-none transition-all duration-300
                            ${!isFormValid
                                ? 'bg-gray-500/50 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 focus:ring-blue-400'
                            }
                        `}
                    >
                        Bắt đầu trò chuyện
                    </button>
                </form>
            </div>
        </div>
    );
};