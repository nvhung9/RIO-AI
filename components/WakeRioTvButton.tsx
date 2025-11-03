import React from 'react';

interface WakeRioTvButtonProps {
    onClick: () => void;
}

export const WakeRioTvButton: React.FC<WakeRioTvButtonProps> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className="absolute top-4 left-4 z-50 p-2 rounded-full bg-gray-800 bg-opacity-60 text-white hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all transform hover:scale-110 animate-pulse-slow"
            aria-label="Đánh thức Rio"
        >
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                <path
                    d="M 50,95 C 20,95 10,75 10,50 C 10,25 20,5 50,5 C 80,5 90,25 90,50 C 90,75 80,95 50,95 Z"
                    fill="white"
                />
                {/* Closed, peaceful eyes */}
                <path d="M 30,50 Q 35,55 40,50" stroke="black" strokeWidth="3" fill="none" />
                <path d="M 60,50 Q 65,55 70,50" stroke="black" strokeWidth="3" fill="none" />
                {/* A subtle, sleeping mouth */}
                <path d="M 48,68 Q 50,70 52,68" stroke="black" strokeWidth="3" fill="none" />
            </svg>
            <style>{`
                @keyframes pulse-slow {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); }
                    50% { transform: scale(1.05); box-shadow: 0 0 0 6px rgba(255, 255, 255, 0); }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 3s ease-in-out infinite;
                }
            `}</style>
        </button>
    );
};
