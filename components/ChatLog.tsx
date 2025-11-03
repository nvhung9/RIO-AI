import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';

// Thêm mới: Icon để đóng cửa sổ lịch sử
const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// Thêm mới: Icon cho tiêu đề của cửa sổ
const ChatHistoryIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


interface ChatHistoryModalProps {
    history: ChatMessage[];
    onClose: () => void;
    userName: string;
    rioName: string;
}

export const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({ history, onClose, userName, rioName }) => {
    // Thêm mới: Ref để tham chiếu đến cuối danh sách tin nhắn, giúp tự động cuộn xuống
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    // Thêm mới: Hàm để cuộn xuống tin nhắn cuối cùng
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }

    // Thêm mới: Tự động cuộn xuống khi lịch sử thay đổi hoặc cửa sổ được mở
    useEffect(() => {
        scrollToBottom();
    }, [history]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in-fast backdrop-blur-sm">
            {/* Cập nhật: Áp dụng hiệu ứng liquid glass cho modal và thêm overflow-hidden */}
            <div className="w-full max-w-lg h-[80vh] flex flex-col bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl text-white overflow-hidden">
                {/* Tiêu đề Modal */}
                {/* Cập nhật: Thay đổi màu viền để phù hợp với hiệu ứng glass */}
                <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/20">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ChatHistoryIcon /> Lịch sử trò chuyện
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-300 hover:text-white hover:bg-white/20">
                        <CloseIcon />
                    </button>
                </div>

                {/* Khu vực hiển thị tin nhắn */}
                <div className="flex-grow overflow-y-auto p-4 space-y-4 chat-scrollbar">
                    {history.length > 0 ? (
                        history.map((message, index) => (
                            <div key={index} className={`flex flex-col ${message.speaker === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`font-bold text-sm mb-1 ${message.speaker === 'user' ? 'text-blue-300' : 'text-purple-300'}`}>
                                    {message.speaker === 'user' ? userName : rioName}
                                </div>
                                <div className={`max-w-[85%] p-3 rounded-lg text-white ${message.speaker === 'user' ? 'bg-blue-600 rounded-br-none' : 'bg-gray-700 rounded-bl-none'}`}>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <p>Chưa có lịch sử trò chuyện.</p>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* CSS cho hiệu ứng và thanh cuộn */}
                <style>{`
                    @keyframes fadeInFast {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    .animate-fade-in-fast {
                        animation: fadeInFast 0.2s ease-out forwards;
                    }
                    .chat-scrollbar::-webkit-scrollbar {
                        width: 8px;
                    }
                    .chat-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .chat-scrollbar::-webkit-scrollbar-thumb {
                        background: #4A5568;
                        border-radius: 4px;
                    }
                    .chat-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #718096;
                    }
                `}</style>
            </div>
        </div>
    );
};