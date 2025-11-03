import React, { useRef, useEffect, useState, useCallback } from 'react';
import { IPTVChannel } from '../types';

declare const Hls: any;

// --- SVG Icon Components for Controls ---
const PlayIcon = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M4.018 15.132A1.25 1.25 0 006 14.156V5.844a1.25 1.25 0 00-1.982-.976l-1.5 1.25a.25.25 0 000 .402l1.5 1.25a1.25 1.25 0 001.982.976v8.312zM6.5 5.5v9a.5.5 0 00.904.3l7-4.5a.5.5 0 000-.6l-7-4.5A.5.5 0 006.5 5.5z" /></svg>;
const PauseIcon = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M5.75 4.5a.75.75 0 00-.75.75v9.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V5.25a.75.75 0 00-.75-.75h-1.5zm6.5 0a.75.75 0 00-.75.75v9.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V5.25a.75.75 0 00-.75-.75h-1.5z" /></svg>;
const VolumeHighIcon = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5.75a.75.75 0 00-1.5 0v8.5a.75.75 0 001.5 0V5.75zM4.25 8.75a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5zM11.75 3.75a.75.75 0 00-1.5 0v12.5a.75.75 0 001.5 0V3.75zM15.25 6.75a.75.75 0 00-1.5 0v6.5a.75.75 0 001.5 0v-6.5z" /></svg>;
const VolumeMutedIcon = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M9.03 4.97a.75.75 0 00-1.06 1.06L10.94 9 7.97 11.97a.75.75 0 101.06 1.06L12 10.06l2.97 2.97a.75.75 0 101.06-1.06L13.06 9l2.97-2.97a.75.75 0 10-1.06-1.06L12 7.94 9.03 4.97z" /></svg>;
const ChannelListIcon = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>;
const FullscreenIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" /></svg>;
const ExitFullscreenIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h6v6m0 0l-7 7M9 21H3v-6m0 0l7-7" /></svg>;
const CloseIcon = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>;


interface IPTVPlayerProps {
    channel: IPTVChannel;
    isExternallyPaused: boolean;
    channels: IPTVChannel[];
    onChannelSelect: (channel: IPTVChannel) => void;
    onClose: () => void;
    isTvFullscreen: boolean;
    onToggleFullscreen: () => void;
    volume: number;
    onVolumeChange: (volume: number) => void;
}

export const IPTVPlayer: React.FC<IPTVPlayerProps> = ({ channel, isExternallyPaused, channels, onChannelSelect, onClose, isTvFullscreen, onToggleFullscreen, volume, onVolumeChange }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const hlsInstanceRef = useRef<any>(null);
    const controlsTimeoutRef = useRef<number | null>(null);

    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [isControlsVisible, setControlsVisible] = useState(true);
    const [isChannelListVisible, setChannelListVisible] = useState(false);

    // --- State Syncing Effects ---
    useEffect(() => {
        setIsPlaying(!isExternallyPaused);
    }, [isExternallyPaused]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            video.play().catch(error => {
                console.warn("Lỗi tự động phát:", error);
                setIsPlaying(false);
            });
        } else {
            video.pause();
        }
    }, [isPlaying]);

    useEffect(() => {
        const video = videoRef.current;
        if (video) video.volume = isMuted ? 0 : volume;
    }, [volume, isMuted]);

    // --- HLS Setup Effect ---
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !channel.url) return;
        
        setChannelListVisible(false); // Hide list on channel change

        if (hlsInstanceRef.current) hlsInstanceRef.current.destroy();

        if (Hls.isSupported()) {
            const hls = new Hls();
            hlsInstanceRef.current = hls;
            hls.loadSource(channel.url);
            hls.attachMedia(video);
            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    console.error('Lỗi HLS:', data.details);
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
                    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
                    else hls.destroy();
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = channel.url;
        }

        // AUTOPLAY FIX: Ensure player is in a playing state on new channel load
        setIsPlaying(true);

        return () => hlsInstanceRef.current?.destroy();
    }, [channel.url]);

    // --- Control Handlers ---
    const togglePlayPause = () => setIsPlaying(prev => !prev);
    const toggleMute = () => setIsMuted(prev => !prev);
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        onVolumeChange(newVolume);
        if (newVolume > 0 && isMuted) setIsMuted(false);
    };
    
    const toggleChannelList = () => setChannelListVisible(prev => !prev);
    
    // --- UI Visibility ---
    const handleActivity = useCallback(() => {
        setControlsVisible(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = window.setTimeout(() => setControlsVisible(false), 3000);
    }, []);

    useEffect(() => {
        const container = playerContainerRef.current;
        if (!container) return;

        // If not playing (paused, etc.), always show controls.
        if (!isPlaying) {
            setControlsVisible(true);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            container.removeEventListener('mousemove', handleActivity);
            return;
        }

        container.addEventListener('mousemove', handleActivity);
        handleActivity(); // Show on mount

        return () => {
            container.removeEventListener('mousemove', handleActivity);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [isPlaying, handleActivity]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in">
             <div ref={playerContainerRef} className="relative w-full max-w-4xl mx-auto bg-black aspect-video rounded-lg overflow-hidden shadow-2xl border border-gray-800">
                <style>{`
                    .control-btn { padding: 0.5rem; border-radius: 9999px; background-color: rgba(31, 41, 55, 0.6); color: white; transition: background-color 0.2s, transform 0.2s; }
                    .control-btn:hover { background-color: rgba(55, 65, 81, 0.8); transform: scale(1.1); }
                    .text-shadow { text-shadow: 0 2px 4px rgba(0, 0, 0, 0.75); }
                    input[type=range] { -webkit-appearance: none; background: transparent; }
                    input[type=range]::-webkit-slider-runnable-track { height: 0.25rem; border-radius: 0.25rem; }
                    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; margin-top: -0.375rem; width: 1rem; height: 1rem; background: white; border-radius: 9999px; cursor: pointer; }
                    .channel-list-scrollbar::-webkit-scrollbar { width: 8px; }
                    .channel-list-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .channel-list-scrollbar::-webkit-scrollbar-thumb { background: #4a5568; border-radius: 4px; }
                    .channel-list-scrollbar::-webkit-scrollbar-thumb:hover { background: #718096; }
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
                    input[type=range]::-webkit-slider-runnable-track { background: linear-gradient(to right, white var(--volume-progress), #4A5568 var(--volume-progress)); }
                `}</style>

                <video ref={videoRef} className="w-full h-full object-contain" playsInline autoPlay onDoubleClick={onToggleFullscreen} />

                {/* Overlays */}
                <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
                <div className={`absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300 ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />

                {/* Top Controls: Channel Info & Close Button */}
                <div className={`absolute top-0 left-0 right-0 p-4 flex items-start justify-between z-10 transition-opacity duration-300 ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                        {channel.logo && <img src={channel.logo} alt={channel.name} className="h-10 w-auto max-w-[6rem] object-contain rounded-md bg-black/50 p-1 flex-shrink-0" />}
                        <h2 className="text-lg font-bold text-white text-shadow truncate">{channel.name}</h2>
                    </div>
                    <button onClick={onClose} className="control-btn ml-auto flex-shrink-0" aria-label="Đóng trình phát">
                        <CloseIcon />
                    </button>
                </div>

                {/* Bottom Controls */}
                <div className={`absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between gap-4 transition-opacity duration-300 ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <div className="flex items-center gap-3">
                        <button onClick={togglePlayPause} className="control-btn">{isPlaying ? <PauseIcon /> : <PlayIcon />}</button>
                        <div className="flex items-center gap-2 group/volume">
                            <button onClick={toggleMute} className="control-btn">{isMuted || volume === 0 ? <VolumeMutedIcon /> : <VolumeHighIcon />}</button>
                            <input
                                type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolumeChange}
                                className="w-0 group-hover/volume:w-24 transition-all duration-300 cursor-pointer"
                                style={{'--volume-progress': `${(isMuted ? 0 : volume) * 100}%`} as React.CSSProperties}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={toggleChannelList} className="control-btn"><ChannelListIcon /></button>
                        <button onClick={onToggleFullscreen} className="control-btn">{isTvFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}</button>
                    </div>
                </div>

                {/* Channel List Panel */}
                <div className={`absolute top-0 bottom-0 right-0 w-64 md:w-72 bg-black/80 backdrop-blur-sm shadow-2xl transition-transform duration-300 ease-in-out ${isChannelListVisible ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="p-3 border-b border-gray-700 flex justify-between items-center">
                        <h3 className="font-bold text-white">Danh sách kênh</h3>
                        <button onClick={toggleChannelList} className="text-gray-400 hover:text-white">&times;</button>
                    </div>
                    <ul className="h-full overflow-y-auto pb-16 channel-list-scrollbar">
                        {channels.map(ch => (
                            <li key={ch.url}>
                                <button 
                                    onClick={() => onChannelSelect(ch)}
                                    className={`w-full flex items-center gap-3 p-2 text-left hover:bg-gray-700/50 transition-colors ${ch.url === channel.url ? 'bg-blue-600/50' : ''}`}
                                >
                                    {ch.logo && <img src={ch.logo} alt="" className="h-8 w-12 object-contain flex-shrink-0" />}
                                    <span className="text-sm text-white truncate">{ch.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};