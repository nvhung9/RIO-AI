import React, { useEffect, useRef, useState, useCallback } from 'react';
import { YouTubeVideo } from '../types';

// --- Type Augmentation for YouTube IFrame API ---
declare global {
    interface Window {
        onYouTubeIframeAPIReady?: () => void;
        YT?: {
            Player: new (elementId: string, options: any) => any;
            PlayerState?: {
                PLAYING: number;
                PAUSED: number;
            };
        };
    }
}


const CloseIcon = () => (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
);

interface YouTubePlayerProps {
    video: YouTubeVideo;
    onClose: () => void;
    volume: number;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ video, onClose, volume }) => {
    const playerRef = useRef<any>(null); // To hold the YT.Player instance
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<number | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isControlsVisible, setIsControlsVisible] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false); // Track player state
    const playerContainerId = `youtube-player-container-${video.id}`;

    // Callback to show controls and set a timer to hide them
    const showControlsAndFade = useCallback(() => {
        setIsControlsVisible(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = window.setTimeout(() => {
            setIsControlsVisible(false);
        }, 3000); // Hide after 3 seconds of inactivity.
    }, []);

    useEffect(() => {
        const onPlayerStateChange = (event: any) => {
            // YT.PlayerState.PLAYING is 1
            if (event.data === window.YT?.PlayerState?.PLAYING || event.data === 1) {
                setIsPlaying(true);
            } else {
                // For PAUSED, ENDED, BUFFERING, etc., keep controls visible
                setIsPlaying(false);
            }
        };

        const createPlayer = () => {
            if (playerRef.current) {
                playerRef.current.destroy();
            }
            setError(null);
            setIsLoading(true);
            setIsPlaying(false);

            playerRef.current = new window.YT.Player(playerContainerId, {
                videoId: video.id,
                playerVars: {
                    'autoplay': 1,
                    'controls': 1,
                    'modestbranding': 1,
                    'playsinline': 1,
                    'origin': window.location.origin,
                },
                events: {
                    'onReady': (event: any) => {
                        setIsLoading(false);
                        event.target.setVolume(volume * 100); // Set initial volume
                        event.target.playVideo(); // Trigger autoplay
                    },
                    'onError': (event: any) => {
                        setIsLoading(false);
                        setIsPlaying(false);
                        let errorMessage = 'Đã xảy ra lỗi không xác định khi phát video.';
                        // Error codes 101 and 150 are the same error, related to embedding disabled by the owner.
                        if (event.data === 101 || event.data === 150) {
                            errorMessage = 'Rất tiếc, người tải lên đã không cho phép phát video này trên các trang web khác.';
                        } else if (event.data === 100) {
                             errorMessage = 'Không tìm thấy video này. Nó có thể đã bị xóa hoặc đặt ở chế độ riêng tư.';
                        }
                        setError(errorMessage);
                    },
                    'onStateChange': onPlayerStateChange
                }
            });
        };

        if (window.YT && window.YT.Player) {
            createPlayer();
        } else {
            window.onYouTubeIframeAPIReady = createPlayer;
        }

        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
        };
    }, [video.id, playerContainerId, volume]);

    // Effect to handle volume changes dynamically after the player is ready
    useEffect(() => {
        if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
            playerRef.current.setVolume(volume * 100);
        }
    }, [volume]);

    // Effect for handling control visibility based on player state and mouse activity
    useEffect(() => {
        const container = playerContainerRef.current;
        if (!container) return;

        // If not playing (paused, ended, error, loading), always show controls.
        if (!isPlaying || isLoading || error) {
            setIsControlsVisible(true);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            // Remove listener to prevent it from hiding controls when not playing
            container.removeEventListener('mousemove', showControlsAndFade);
            return;
        }
        
        // If playing, add the mousemove listener and start the fade timer.
        container.addEventListener('mousemove', showControlsAndFade);
        showControlsAndFade(); // Initial call to show and start the timer.

        return () => {
            container.removeEventListener('mousemove', showControlsAndFade);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [isPlaying, isLoading, error, showControlsAndFade]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in">
            <div ref={playerContainerRef} className="relative w-full max-w-4xl mx-auto bg-black aspect-video rounded-lg overflow-hidden shadow-2xl border border-gray-800">
                <style>{`
                    .control-btn { padding: 0.5rem; border-radius: 9999px; background-color: rgba(31, 41, 55, 0.6); color: white; transition: background-color 0.2s, transform 0.2s; }
                    .control-btn:hover { background-color: rgba(55, 65, 81, 0.8); transform: scale(1.1); }
                    .text-shadow { text-shadow: 0 2px 4px rgba(0, 0, 0, 0.75); }
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
                `}</style>
                
                <div className={`absolute top-0 left-0 right-0 p-4 flex items-start justify-between z-10 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <h2 className="text-lg font-bold text-white text-shadow max-w-[calc(100%-4rem)]">{video.title}</h2>
                    <button onClick={onClose} className="control-btn" aria-label="Đóng trình phát YouTube">
                        <CloseIcon />
                    </button>
                </div>
                
                <div id={playerContainerId} className="absolute inset-0 w-full h-full"></div>
                
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4 text-center">
                        <div className="text-white text-lg">Đang tải video...</div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4">
                        <div className="text-red-400 text-xl font-semibold mb-2">Không thể phát video</div>
                        <div className="text-white text-center text-sm">{error}</div>
                    </div>
                )}
            </div>
        </div>
    );
};