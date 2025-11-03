import React, { useState, useEffect } from 'react';
// Thêm mới: Import kiểu dữ liệu BackgroundSettings
import { UserProfile, BackgroundSettings } from '../types';
import * as geminiService from '../services/geminiService';

interface SettingsProps {
    profile: UserProfile;
    onSave: (updatedProfile: UserProfile) => void;
    onClearHistory: () => void;
    onClose: () => void;
}

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const SpeakerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
    </svg>
);

// Thêm mới: Định nghĩa các dải màu gradient có sẵn
const gradientOptions = [
    { name: 'Mặc định', class: 'gradient-default' },
    { name: 'Bắc Cực Quang', class: 'gradient-aurora' },
    { name: 'Hoàng Hôn', class: 'gradient-dusk' },
    { name: 'Đại Dương', class: 'gradient-ocean' },
    { name: 'Thiên Hà', class: 'gradient-galaxy' },
];

// Thêm mới: Hàm trợ giúp để chuyển đổi chuỗi Base64 sang đối tượng Blob để lưu vào IndexedDB.
const base64ToBlob = (base64: string): Blob | null => {
    try {
        const parts = base64.split(';base64,');
        if (parts.length !== 2) return null;
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        return new Blob([uInt8Array], { type: contentType });
    } catch (e) {
        console.error("Lỗi chuyển đổi base64 sang Blob:", e);
        return null;
    }
};

export const SettingsModal: React.FC<SettingsProps> = ({ profile, onSave, onClearHistory, onClose }) => {
    const [name, setName] = useState(profile.name);
    const [rioName, setRioName] = useState(profile.rioName || 'Rio');
    const [wakeWord, setWakeWord] = useState(profile.wakeWord || '');
    const [voice, setVoice] = useState(profile.voice || 'Zephyr');
    const [isTestingVoice, setIsTestingVoice] = useState(false);

    // Thêm mới: State để quản lý cài đặt nền
    const [backgroundSettings, setBackgroundSettings] = useState<BackgroundSettings>(
        profile.backgroundSettings || { type: 'gradient', value: 'gradient-default' }
    );
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (!profile.wakeWord) {
            setWakeWord(`${rioName} ơi`);
        }
    }, [rioName, profile.wakeWord]);

    const handleSave = () => {
        onSave({
            ...profile,
            name: name.trim(),
            rioName: rioName.trim(),
            wakeWord: wakeWord.trim(),
            voice: voice,
            backgroundSettings: backgroundSettings, // Thêm mới: Lưu cài đặt nền
        });
    };

    const handleClear = () => {
        if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử cuộc trò chuyện không? Hành động này không thể hoàn tác.")) {
            onClearHistory();
            alert("Đã xóa lịch sử trò chuyện.");
        }
    };

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
    
    // Cập nhật: Hàm xử lý tải ảnh lên để sử dụng IndexedDB
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setIsUploading(true);
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const base64String = e.target?.result as string;
                    const imageBlob = base64ToBlob(base64String);
                    if (!imageBlob) {
                        throw new Error("Không thể chuyển đổi file ảnh.");
                    }
                    
                    // Lưu ảnh vào IndexedDB thay vì state/localStorage
                    await geminiService.saveMedia('custom-background', imageBlob);
                    
                    // Cập nhật state để chỉ lưu một key tham chiếu, không lưu dữ liệu ảnh.
                    setBackgroundSettings({
                        type: 'image',
                        value: 'custom-background', // Sử dụng một key thay vì chuỗi base64
                        overlay: backgroundSettings.overlay ?? 0.5,
                        size: backgroundSettings.size ?? 'cover',
                    });
                } catch (error) {
                    console.error(error);
                    alert('Không thể lưu ảnh nền. Vui lòng thử lại.');
                } finally {
                    setIsUploading(false);
                }
            };
            reader.onerror = () => {
                alert('Không thể đọc file ảnh.');
                setIsUploading(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const isSaveDisabled = !name.trim() || !rioName.trim() || !wakeWord.trim();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in-fast backdrop-blur-sm">
            <div className="w-full max-w-md p-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl text-white">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <SettingsIcon /> Cài đặt
                    </h2>
                    <button onClick={onClose} className="text-gray-300 hover:text-white">&times;</button>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div>
                        <label htmlFor="userName" className="block mb-2 text-sm font-medium text-gray-300">Tên của bạn</label>
                        <input id="userName" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-white bg-black/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Nhập tên của bạn" />
                    </div>
                    <div>
                        <label htmlFor="rioName" className="block mb-2 text-sm font-medium text-gray-300">Tên của trợ lý</label>
                        <input id="rioName" type="text" value={rioName} onChange={(e) => setRioName(e.target.value)} className="w-full px-3 py-2 text-white bg-black/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Ví dụ: Rio" />
                    </div>
                    <div>
                        <label htmlFor="wakeWord" className="block mb-2 text-sm font-medium text-gray-300">Từ khóa đánh thức</label>
                        <input id="wakeWord" type="text" value={wakeWord} onChange={(e) => setWakeWord(e.target.value)} className="w-full px-3 py-2 text-white bg-black/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Ví dụ: Rio ơi" />
                    </div>
                     <div>
                        <label htmlFor="rioVoice" className="block mb-2 text-sm font-medium text-gray-300">Giọng nói của trợ lý</label>
                        <div className="flex items-center gap-2">
                            <select id="rioVoice" value={voice} onChange={(e) => setVoice(e.target.value)} className="flex-grow w-full px-3 py-2 text-white bg-black/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                                {geminiService.availableVoices.map((v) => (
                                    <option key={v.id} value={v.id} className="bg-gray-800">{v.name}</option>
                                ))}
                            </select>
                            <button onClick={handleTestVoice} disabled={isTestingVoice} className="p-3 bg-black/20 border border-white/30 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-wait" aria-label="Nghe thử giọng nói">
                                {isTestingVoice ? (
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : ( <SpeakerIcon /> )}
                            </button>
                        </div>
                    </div>

                    {/* Thêm mới: Khu vực cài đặt nền */}
                    <div className="pt-2 border-t border-white/20">
                        <label className="block mb-2 text-sm font-medium text-gray-300">Nền giao diện</label>
                        <div className="flex items-center justify-center gap-2 mb-3">
                            {['gradient', 'image'].map(type => (
                                <label key={type} className="flex-grow">
                                    <input type="radio" name="bg-type" value={type} checked={backgroundSettings.type === type} onChange={() => setBackgroundSettings(prev => ({ ...prev, type: type as 'gradient' | 'image' }))} className="sr-only peer" />
                                    <div className="w-full py-2 px-4 text-center text-gray-300 bg-black/20 border-2 border-white/30 rounded-lg cursor-pointer peer-checked:bg-blue-600 peer-checked:border-blue-500 peer-checked:text-white transition-colors">
                                        {type === 'gradient' ? 'Dải màu' : 'Ảnh nền'}
                                    </div>
                                </label>
                            ))}
                        </div>
                        
                        {backgroundSettings.type === 'gradient' && (
                            <div className="grid grid-cols-3 gap-2">
                                {gradientOptions.map(opt => (
                                    <div key={opt.class} onClick={() => setBackgroundSettings(prev => ({ ...prev, value: opt.class }))} className={`h-12 rounded-lg cursor-pointer flex items-center justify-center text-xs text-white/80 border-2 ${backgroundSettings.value === opt.class ? 'border-blue-400' : 'border-transparent'} ${opt.class}`}>
                                        {opt.name}
                                    </div>
                                ))}
                            </div>
                        )}

                        {backgroundSettings.type === 'image' && (
                            <div className="space-y-4 p-3 bg-black/20 rounded-lg">
                                <label className="w-full flex items-center justify-center px-3 py-2 text-white bg-black/20 border border-white/30 rounded-lg cursor-pointer hover:bg-white/20">
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                                    <span>{isUploading ? 'Đang tải...' : 'Chọn ảnh từ máy tính'}</span>
                                </label>
                                
                                {/* Cập nhật: Thay đổi điều kiện hiển thị để kiểm tra key thay vì chuỗi base64. */}
                                {backgroundSettings.value === 'custom-background' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-gray-400">Độ mờ & tối</label>
                                            <input type="range" min="0" max="1" step="0.05" value={backgroundSettings.overlay ?? 0.5} onChange={e => setBackgroundSettings(prev => ({ ...prev, overlay: parseFloat(e.target.value) }))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400">Kiểu hiển thị</label>
                                            <select value={backgroundSettings.size ?? 'cover'} onChange={e => setBackgroundSettings(prev => ({ ...prev, size: e.target.value as any }))} className="w-full px-3 py-2 text-sm text-white bg-black/20 border border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                                                <option value="cover" className="bg-gray-800">Lấp đầy</option>
                                                <option value="contain" className="bg-gray-800">Vừa vặn</option>
                                                <option value="repeat" className="bg-gray-800">Lặp lại</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="pt-2 border-t border-white/20">
                        <label className="block mb-2 text-sm font-medium text-gray-300">Quản lý dữ liệu</label>
                         <button onClick={handleClear} className="w-full px-4 py-2 text-sm font-medium text-white bg-red-500/30 border border-red-500/50 rounded-lg hover:bg-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors">
                            Xóa lịch sử trò chuyện
                        </button>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 font-semibold text-gray-200 bg-black/20 border border-white/30 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-gray-400">Hủy</button>
                    <button onClick={handleSave} disabled={isSaveDisabled} className={`px-6 py-2 font-semibold text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${isSaveDisabled ? 'bg-gray-500/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}>Lưu</button>
                </div>
            </div>
             <style>{`
                @keyframes fadeInFast { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in-fast { animation: fadeInFast 0.2s ease-out forwards; }
                /* Thêm mới: Các class cho gradient nền */
                .gradient-default { background-image: radial-gradient(ellipse at top, var(--tw-gradient-stops)); --tw-gradient-from: #4a5568; --tw-gradient-to: #1a202c; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
                .gradient-aurora { background-image: linear-gradient(to top right, #0f0c29, #302b63, #24243e); }
                .gradient-dusk { background-image: linear-gradient(to top right, #2c3e50, #fd746c); }
                .gradient-ocean { background-image: linear-gradient(to top right, #00c6ff, #0072ff); }
                .gradient-galaxy { background-image: linear-gradient(to top right, #232526, #414345); }
             `}</style>
        </div>
    );
};