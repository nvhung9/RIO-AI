import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import RioDisplay from './components/RioDisplay';
import { UserInfoForm } from './components/UserInfoForm';
import { EphemeralDisplay } from './components/EphemeralDisplay';
import { RioState, UserProfile, ChatMessage, IPTVChannel, YouTubeVideo } from './types';
import * as geminiService from './services/geminiService';
import * as alarmService from './services/alarmService';
import * as iptvService from './services/iptvService';
import { getChatHistory, clearChatHistory } from './services/indexedDBService';
import Clock from './components/Clock';
import { DeepSleepRio } from './components/RioExpressions';
import { WakeRioTvButton } from './components/WakeRioTvButton';
import { FullscreenButton } from './components/FullscreenButton';

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const ChatHistoryIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const GalleryIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const CreatorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
);


const SettingsModal = lazy(() => import('./components/Controls').then(module => ({ default: module.SettingsModal })));
const ChatHistoryModal = lazy(() => import('./components/ChatLog').then(module => ({ default: module.ChatHistoryModal })));
const RioGallery = lazy(() => import('./components/RioGallery').then(module => ({ default: module.RioGallery })));
const RioCreator = lazy(() => import('./components/RioCreator').then(module => ({ default: module.RioCreator })));
const IPTVPlayer = lazy(() => import('./components/IPTVPlayer').then(module => ({ default: module.IPTVPlayer })));
const YouTubePlayer = lazy(() => import('./components/YouTubePlayer').then(module => ({ default: module.YouTubePlayer })));

const renderModalFallback = (message: string) => (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 text-white z-50">
        <div className="animate-pulse text-lg font-semibold">{message}</div>
    </div>
);


const App: React.FC = () => {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [shouldStartSession, setShouldStartSession] = useState(false);
    
    const [rioState, setRioState] = useState<RioState>(RioState.IDLE);
    const [statusText, setStatusText] = useState<string>('');
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [currentTranscription, setCurrentTranscription] = useState<ChatMessage | null>(null);
    const [ringingAlarmInfo, setRingingAlarmInfo] = useState<{ label: string; id: number; type: 'alarm' | 'reminder' } | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);

    const [isControlsVisible, setIsControlsVisible] = useState(true);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isGalleryVisible, setIsGalleryVisible] = useState(false);
    const [isCreatorVisible, setIsCreatorVisible] = useState(false);
    const playbackTimeoutRef = useRef<number | null>(null);
    const appContainerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<number | null>(null);
    const clickTimeoutRef = useRef<number | null>(null);
    
    const [pixelOffset, setPixelOffset] = useState({ x: 0, y: 0 });

    const [currentChannel, setCurrentChannel] = useState<IPTVChannel | null>(null);
    const [currentYouTubeVideo, setCurrentYouTubeVideo] = useState<YouTubeVideo | null>(null);
    const [allChannels, setAllChannels] = useState<IPTVChannel[]>([]);
    const [isTvPlaying, setIsTvPlaying] = useState(false);
    const [isTvFullscreen, setIsTvFullscreen] = useState(false);
    const [isAppFullscreen, setIsAppFullscreen] = useState(!!document.fullscreenElement);
    
    const [volume, setVolume] = useState<number>(1);
    const [brightness, setBrightness] = useState<number>(1);

    const [isPowerSaving, setIsPowerSaving] = useState(false);
    const inactivityTimerRef = useRef<number | null>(null);
    const rioStateRef = useRef(rioState);
    const currentChannelRef = useRef(currentChannel);
    const currentYouTubeVideoRef = useRef(currentYouTubeVideo);
    const INACTIVITY_TIMEOUT = 2 * 60 * 1000;
    const previousRioStateRef = useRef<RioState>(RioState.IDLE);

    // Thêm mới: State để lưu URL tạm thời của ảnh nền tùy chỉnh đọc từ IndexedDB.
    const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
    // Thêm mới: Ref để theo dõi URL cũ và giải phóng bộ nhớ.
    const prevCustomBgUrl = useRef<string | null>(null);

    const speed = 2.5;
    const delay = 1800;

    useEffect(() => {
        rioStateRef.current = rioState;
    }, [rioState]);

    useEffect(() => {
        currentChannelRef.current = currentChannel;
    }, [currentChannel]);

    useEffect(() => {
        currentYouTubeVideoRef.current = currentYouTubeVideo;
    }, [currentYouTubeVideo]);

    const showControlsAndFade = useCallback(() => {
        setIsControlsVisible(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = window.setTimeout(() => {
            setIsControlsVisible(false);
        }, 3000);
    }, []);

    const resetInactivityTimer = useCallback(() => {
        showControlsAndFade();
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
        }
        setIsPowerSaving(false);

        inactivityTimerRef.current = window.setTimeout(() => {
            if (rioStateRef.current === RioState.IDLE && !currentChannelRef.current && !currentYouTubeVideoRef.current) {
                setIsPowerSaving(true);
            }
        }, INACTIVITY_TIMEOUT);
    }, [showControlsAndFade]);

    useEffect(() => {
        let intervalId: number | null = null;
        
        if (isPowerSaving || rioState === RioState.IDLE) {
            const positions = [
                { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
                { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
                { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 0, y: 0 },
            ];
            let positionIndex = 0;

            intervalId = window.setInterval(() => {
                positionIndex = (positionIndex + 1) % positions.length;
                setPixelOffset(positions[positionIndex]);
            }, 60000);
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
            setPixelOffset({ x: 0, y: 0 });
        };
    }, [rioState, isPowerSaving]);

    useEffect(() => {
        const savedProfile = localStorage.getItem('rioUserProfile');
        if (savedProfile) {
            setUserProfile(JSON.parse(savedProfile));
        }

        const loadChannels = async () => {
            const channels = await iptvService.fetchChannels();
            setAllChannels(channels);
        };
        loadChannels();

        // Load lịch sử trò chuyện từ IndexedDB khi khởi động
        const loadChatHistory = async () => {
            try {
                const history = await getChatHistory();
                if (history && history.length > 0) {
                    setChatHistory(history);
                }
            } catch (err) {
                console.error("Lỗi khi load lịch sử trò chuyện:", err);
            }
        };
        loadChatHistory();

        return () => {
            if (playbackTimeoutRef.current) {
                clearTimeout(playbackTimeoutRef.current);
            }
        }
    }, []);

    const handleStateChange = useCallback((newState: RioState, newStatus?: string) => {
        setRioState(newState);
        if (newStatus) setStatusText(newStatus);
        
        if (newState !== RioState.ALARM_RINGING) {
          setRingingAlarmInfo(null);
        }
      }, []);

    useEffect(() => {
        alarmService.registerCallbacks(
            (label, id, type) => {
                resetInactivityTimer();
                setRingingAlarmInfo({ label, id, type });
            },
            handleStateChange
        );
    }, [resetInactivityTimer, handleStateChange]);

    useEffect(() => {
        const previousState = previousRioStateRef.current;
        if (rioState !== previousState) {
            switch (rioState) {
                case RioState.LISTENING:
                    if (previousState === RioState.IDLE || previousState === RioState.ENTERING_DEEP_SLEEP) {
                        alarmService.playWakeSound();
                    } else {
                        alarmService.playBoop();
                    }
                    break;
                case RioState.SPEAKING:
                    alarmService.playMessageTing();
                    break;
                case RioState.ERROR:
                    alarmService.playErrorSound();
                    break;
                case RioState.ENTERING_DEEP_SLEEP:
                    alarmService.playSleepSound();
                    break;
            }
        }
        previousRioStateRef.current = rioState;
    }, [rioState]);

    const handleProfileSubmit = (profile: UserProfile) => {
        setUserProfile(profile);
        localStorage.setItem('rioUserProfile', JSON.stringify(profile));
        alarmService.initAlarmAudio();
        setShouldStartSession(true);
    };

    const handleSaveSettings = useCallback(async (updatedProfile: UserProfile) => {
        setUserProfile(updatedProfile);
        localStorage.setItem('rioUserProfile', JSON.stringify(updatedProfile));
        setIsSettingsVisible(false);

        // Không cần khởi động lại session, chỉ cần lưu là đủ
    }, []);


    const handleClearHistory = useCallback(async () => {
        await geminiService.clearConversationHistory();
        setChatHistory([]);
        // Xóa lịch sử trong IndexedDB
        clearChatHistory().catch(err => {
            console.error("Lỗi khi xóa lịch sử trò chuyện:", err);
        });
    }, []);
  
    const handleHistoryUpdate = useCallback((newHistory: ChatMessage[]) => {
      setChatHistory(newHistory);
    }, []);
  
    const handleTranscriptionUpdate = useCallback((message: ChatMessage | null) => {
      setCurrentTranscription(message);
    }, []);

    const handlePlayTvChannel = useCallback((channel: IPTVChannel) => {
        if (playbackTimeoutRef.current) {
            clearTimeout(playbackTimeoutRef.current);
        }
        setCurrentYouTubeVideo(null);
        setCurrentChannel(channel);
        setIsTvPlaying(false);
        geminiService.notifyTvState(true);

        playbackTimeoutRef.current = window.setTimeout(() => {
            setIsTvPlaying(true);
        }, 5000);
    }, []);

    const handleCloseTvPlayer = useCallback(() => {
        if (playbackTimeoutRef.current) {
            clearTimeout(playbackTimeoutRef.current);
            playbackTimeoutRef.current = null;
        }
        setCurrentChannel(null);
        setIsTvPlaying(false);
        setIsTvFullscreen(false);
        geminiService.notifyTvState(false);
        const rioName = userProfile?.rioName || 'Rio';
        handleStateChange(RioState.IDLE, `${rioName} đang nghỉ ngơi...`);
    }, [handleStateChange, userProfile]);

    const handlePlayYouTubeVideo = useCallback((videoId: string, videoTitle: string) => {
        handleCloseTvPlayer();
        setCurrentYouTubeVideo({ id: videoId, title: videoTitle });
    }, [handleCloseTvPlayer]);

    const handleCloseYouTubePlayer = useCallback(() => {
        setCurrentYouTubeVideo(null);
        const rioName = userProfile?.rioName || 'Rio';
        handleStateChange(RioState.IDLE, `${rioName} đang nghỉ ngơi...`);
    }, [handleStateChange, userProfile]);

    const handleResumeTv = useCallback(() => {
        setIsTvPlaying(true);
        handleStateChange(RioState.IDLE);
    }, [handleStateChange]);

    const handleToggleTvFullscreen = useCallback(() => {
        setIsTvFullscreen(prev => !prev);
    }, []);

    const handleToggleAppFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            appContainerRef.current?.requestFullscreen().catch(console.error);
        } else {
            document.exitFullscreen().catch(console.error);
        }
    }, []);

    useEffect(() => {
        const syncFullscreenState = () => {
            setIsAppFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', syncFullscreenState);
        return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
    }, []);

    const handleDismissAlarm = useCallback(() => {
        alarmService.stopCurrentAlarm();
    }, []);

    const handleSetVolume = useCallback((level: number) => {
        setVolume(level / 100);
    }, []);

    const handleSetBrightness = useCallback((level: number) => {
        setBrightness(level / 100);
    }, []);

    const getCurrentState = useCallback(() => rioStateRef.current, []);

    const handleSessionEnd = useCallback(() => {
        setIsSessionActive(false);
    }, []);
  
    const startSession = useCallback(async () => {
      if (isSessionActive || !userProfile) return;
  
      setIsSessionActive(true);
      setCurrentTranscription(null);
      await geminiService.startLiveSession(
        handleStateChange, 
        handleHistoryUpdate, 
        handleTranscriptionUpdate,
        handlePlayTvChannel,
        handleResumeTv,
        handlePlayYouTubeVideo,
        handleSetVolume,
        handleSetBrightness,
        handleSessionEnd,
        getCurrentState,
        userProfile
      );
    }, [isSessionActive, userProfile, handleStateChange, handleHistoryUpdate, handleTranscriptionUpdate, handlePlayTvChannel, handleResumeTv, handlePlayYouTubeVideo, handleSetVolume, handleSetBrightness, handleSessionEnd, getCurrentState]);
  
    const stopSession = useCallback(() => {
        if (playbackTimeoutRef.current) {
            clearTimeout(playbackTimeoutRef.current);
            playbackTimeoutRef.current = null;
        }

        if (!isSessionActive || !userProfile) return;
        geminiService.stopLiveSession(userProfile.name);
        setCurrentChannel(null);
        setCurrentYouTubeVideo(null);
        geminiService.notifyTvState(false);
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(console.error);
        }
    }, [isSessionActive, userProfile]);
  
    const handleRioDoubleClick = useCallback(() => {
        if (!userProfile) return;
        const rioName = userProfile.rioName || 'Rio';
        const wakeWord = userProfile.wakeWord || `${rioName} ơi`;
        
        resetInactivityTimer();
        if (rioState === RioState.ALARM_RINGING) {
            handleDismissAlarm();
            return;
        }
        if (currentChannel) {
            geminiService.notifyTvInteractionStarted();
        }
        if (!isSessionActive) {
            startSession();
        } else {
            if (rioState === RioState.IDLE) {
                handleStateChange(RioState.LISTENING, `${rioName} nghe đây!`);
            } else {
                handleStateChange(RioState.IDLE, `Đã tạm dừng. Nói '${wakeWord}' để tiếp tục.`);
            }
        }
    }, [isSessionActive, rioState, startSession, handleStateChange, resetInactivityTimer, handleDismissAlarm, currentChannel, userProfile]);

    const handleRioInteraction = useCallback(() => {
        if (clickTimeoutRef.current !== null) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
            handleRioDoubleClick();
        } else {
            clickTimeoutRef.current = window.setTimeout(() => {
                if (userProfile) {
                    alarmService.playBoop();
                }
                clickTimeoutRef.current = null;
            }, 250);
        }
    }, [handleRioDoubleClick, userProfile]);

    const handleWakeFromTv = useCallback(() => {
        if (!userProfile) return;
        const rioName = userProfile.rioName || 'Rio';
        geminiService.notifyTvInteractionStarted();
        handleStateChange(RioState.LISTENING, `${rioName} nghe đây!`);
        if (isTvFullscreen) {
            setIsTvFullscreen(false);
        }
    }, [handleStateChange, isTvFullscreen, userProfile]);
    
    useEffect(() => {
      if (shouldStartSession) {
        startSession();
        setShouldStartSession(false); 
      }
    }, [shouldStartSession, startSession]);
  
    useEffect(() => {
        if (
            rioState === RioState.LISTENING ||
            rioState === RioState.THINKING ||
            rioState === RioState.SPEAKING
        ) {
            resetInactivityTimer();
        }
    }, [rioState, resetInactivityTimer]);

    useEffect(() => {
        if (
            (rioState === RioState.LISTENING ||
            rioState === RioState.THINKING ||
            rioState === RioState.SPEAKING) &&
            currentChannel
        ) {
            setIsTvPlaying(false);
        }
    }, [rioState, currentChannel]);

    useEffect(() => {
        if (rioState === RioState.ENTERING_DEEP_SLEEP) {
            setIsPowerSaving(true);
        } else if (rioState !== RioState.ENTERING_DEEP_SLEEP && isPowerSaving) {
            // Tắt power saving khi thoát khỏi deep sleep
            setIsPowerSaving(false);
        }
    }, [rioState, isPowerSaving]);

    useEffect(() => {
        const container = appContainerRef.current;
        if (!container) return;
        
        resetInactivityTimer();

        const events: (keyof HTMLElementEventMap)[] = ['mousemove', 'mousedown', 'touchstart', 'keydown'];
        events.forEach(event => container.addEventListener(event, resetInactivityTimer));
        
        return () => {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            events.forEach(event => container.removeEventListener(event, resetInactivityTimer));
        };
    }, [resetInactivityTimer]);
    
    // Thêm mới: Effect để tải ảnh nền tùy chỉnh từ IndexedDB khi hồ sơ người dùng thay đổi.
    useEffect(() => {
        const loadCustomBg = async () => {
            // Quan trọng: Giải phóng URL cũ để tránh rò rỉ bộ nhớ.
            if (prevCustomBgUrl.current) {
                URL.revokeObjectURL(prevCustomBgUrl.current);
                prevCustomBgUrl.current = null;
            }
    
            if (userProfile?.backgroundSettings?.type === 'image' && userProfile.backgroundSettings.value === 'custom-background') {
                try {
                    const imageBlob = await geminiService.getMedia('custom-background');
                    if (imageBlob) {
                        const url = URL.createObjectURL(imageBlob);
                        setCustomBgUrl(url);
                        prevCustomBgUrl.current = url; // Lưu lại để giải phóng sau
                    } else {
                        setCustomBgUrl(null); // Không tìm thấy ảnh trong DB
                    }
                } catch (error) {
                    console.error("Không thể tải ảnh nền tùy chỉnh:", error);
                    setCustomBgUrl(null); // Quay lại mặc định nếu tải lỗi
                }
            } else {
                setCustomBgUrl(null); // Không phải ảnh tùy chỉnh
            }
        };
    
        loadCustomBg();
    
        // Hàm cleanup để chạy khi component unmount
        return () => {
            if (prevCustomBgUrl.current) {
                URL.revokeObjectURL(prevCustomBgUrl.current);
            }
        };
    }, [userProfile]);

    // Cập nhật: Sửa lại hàm getBackgroundProps để sử dụng customBgUrl từ state khi cần.
    const getBackgroundProps = () => {
        // Khi vào deep sleep, nền chuyển sang màu đen hoàn toàn
        if (rioState === RioState.ENTERING_DEEP_SLEEP) {
            return {
                style: {
                    backgroundColor: '#000000',
                    backgroundImage: 'none',
                },
                className: ''
            };
        }
        
        const bgSettings = userProfile?.backgroundSettings;
        if (bgSettings?.type === 'image' && bgSettings.value === 'custom-background' && customBgUrl) {
            return {
                style: {
                    backgroundImage: `url(${customBgUrl})`,
                    backgroundSize: bgSettings.size || 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: bgSettings.size === 'repeat' ? 'repeat' : 'no-repeat',
                },
                className: ''
            };
        }
        // Mặc định trả về class gradient
        const gradientClass = (bgSettings?.type === 'gradient' ? bgSettings.value : 'gradient-default') || 'gradient-default';
        return {
            style: {},
            className: gradientClass
        };
    };

    const isStatusState = rioState === RioState.IDLE || rioState === RioState.ERROR || rioState === RioState.LOADING || rioState === RioState.SPEAKING;
    const bgProps = getBackgroundProps();

    if (!userProfile) {
        return <UserInfoForm onSubmit={handleProfileSubmit} />;
    }

    if (rioState === RioState.ALARM_RINGING && ringingAlarmInfo) {
        return (
            <div className="flex flex-col items-center justify-around min-h-screen font-sans bg-black p-4 text-white animate-pulse-alarm">
                 <style>{`
                    @keyframes pulse-alarm {
                        0%, 100% { background-color: #000; }
                        50% { background-color: #2b0000; }
                    }
                    .animate-pulse-alarm {
                        animation: pulse-alarm 2s ease-in-out infinite;
                    }
                 `}</style>
                 <div className="text-center">
                    <h1 className="text-4xl font-bold text-red-400 mb-4 tracking-widest">BÁO THỨC</h1>
                    <p className="text-3xl mt-8 mb-12 animate-fade-in">{ringingAlarmInfo.label}</p>
                 </div>
                 <Clock variant="aod" />
                 <button
                     onClick={handleDismissAlarm}
                     className="px-12 py-5 text-2xl font-bold text-white bg-red-600 rounded-full shadow-lg transform hover:scale-105 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-red-400"
                 >
                     TẮT
                 </button>
            </div>
        );
    }

    return (
      <div 
        ref={appContainerRef}
        // Cập nhật: Áp dụng class và style động cho nền
        className={`relative flex flex-col items-center justify-center min-h-screen font-sans p-4 text-white outline-none transition-all duration-1000 ${bgProps.className}`}
        style={bgProps.style}
        tabIndex={-1}
      >
        {/* Thêm mới: Lớp phủ cho ảnh nền */}
        {userProfile.backgroundSettings?.type === 'image' && rioState !== RioState.ENTERING_DEEP_SLEEP && (
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-all duration-500"
                style={{
                    backgroundColor: `rgba(0, 0, 0, ${0.2 + (userProfile.backgroundSettings.overlay ?? 0.5) * 0.6})`,
                    backdropFilter: `blur(${(userProfile.backgroundSettings.overlay ?? 0.5) * 10}px)`
                }}
            />
        )}
        {/* Lớp phủ đen hoàn toàn khi ở deep sleep */}
        {rioState === RioState.ENTERING_DEEP_SLEEP && (
            <div
                className="absolute inset-0 bg-black transition-opacity duration-500"
                style={{ zIndex: 1 }}
            />
        )}
         {/* Thêm mới: Định nghĩa các lớp CSS cho gradient nền */}
        <style>{`
            .gradient-default { background: radial-gradient(ellipse at top, #2d3748, #1a202c); }
            .gradient-aurora { background-image: linear-gradient(to top right, #0f0c29, #302b63, #24243e); }
            .gradient-dusk { background-image: linear-gradient(to top right, #2c3e50, #fd746c); }
            .gradient-ocean { background-image: linear-gradient(to top right, #00c6ff, #0072ff); }
            .gradient-galaxy { background-image: linear-gradient(to top right, #232526, #414345); }
        `}</style>


        <div
            className="fixed inset-0 bg-black transition-opacity duration-500 pointer-events-none"
            style={{ opacity: 1 - brightness, zIndex: 9999 }}
            aria-hidden="true"
        />

        {isSettingsVisible && (
            <Suspense fallback={renderModalFallback('Đang tải bảng cài đặt...')}>
                <SettingsModal
                    profile={userProfile}
                    onSave={handleSaveSettings}
                    onClearHistory={handleClearHistory}
                    onClose={() => setIsSettingsVisible(false)}
                />
            </Suspense>
        )}
        
        {isHistoryVisible && (
            <Suspense fallback={renderModalFallback('Đang tải lịch sử trò chuyện...')}>
                <ChatHistoryModal
                    history={chatHistory}
                    onClose={() => setIsHistoryVisible(false)}
                    userName={userProfile.name}
                    rioName={userProfile.rioName || 'Rio'}
                />
            </Suspense>
        )}

        {isGalleryVisible && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
                <div className="relative w-full h-full overflow-auto p-4">
                    <button
                        onClick={() => setIsGalleryVisible(false)}
                        className="fixed top-4 right-4 z-10 p-3 bg-gray-800 bg-opacity-50 text-white rounded-full hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 text-2xl"
                        aria-label="Đóng gallery"
                    >
                        &times;
                    </button>
                    <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-white animate-pulse">Đang tải gallery...</div>}>
                        <RioGallery />
                    </Suspense>
                </div>
            </div>
        )}

        {isCreatorVisible && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
                <div className="relative w-full h-full overflow-auto p-4">
                    <button
                        onClick={() => setIsCreatorVisible(false)}
                        className="fixed top-4 right-4 z-10 p-3 bg-gray-800 bg-opacity-50 text-white rounded-full hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 text-2xl"
                        aria-label="Đóng creator"
                    >
                        &times;
                    </button>
                    <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-white animate-pulse">Đang tải trình tạo biểu cảm...</div>}>
                        <RioCreator />
                    </Suspense>
                </div>
            </div>
        )}

        {currentChannel && isTvFullscreen && <WakeRioTvButton onClick={handleWakeFromTv} />}

        <div className={`absolute top-4 right-4 z-50 flex items-center gap-2 transition-opacity duration-500 ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
             <button
                onClick={() => setIsHistoryVisible(true)}
                className="p-2 rounded-full bg-gray-800 bg-opacity-50 text-white hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                aria-label="Xem lịch sử trò chuyện"
            >
                <ChatHistoryIcon />
            </button>
            <button
                onClick={() => setIsGalleryVisible(true)}
                className="p-2 rounded-full bg-gray-800 bg-opacity-50 text-white hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                aria-label="Xem gallery biểu cảm Rio"
                title="Xem gallery biểu cảm"
            >
                <GalleryIcon />
            </button>
            <button
                onClick={() => setIsCreatorVisible(true)}
                className="p-2 rounded-full bg-gray-800 bg-opacity-50 text-white hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                aria-label="Tạo biểu cảm Rio mới"
                title="Tạo biểu cảm mới"
            >
                <CreatorIcon />
            </button>
            <button
                onClick={() => setIsSettingsVisible(true)}
                className="p-2 rounded-full bg-gray-800 bg-opacity-50 text-white hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                aria-label={`Cài đặt ${userProfile.rioName || 'Rio'}`}
            >
                <SettingsIcon />
            </button>
            <FullscreenButton isFullscreen={isAppFullscreen} onClick={handleToggleAppFullscreen} />
        </div>

        {isPowerSaving ? (
            <div
                className="flex flex-col items-center justify-center flex-1 animate-fade-in z-10"
                style={{
                    transform: `translate(${pixelOffset.x}px, ${pixelOffset.y}px)`,
                    transition: 'transform 2s ease-in-out'
                }}
                onClick={handleRioInteraction}
            >
                <DeepSleepRio speed={speed} />
                <div className="mt-4">
                    <Clock variant="aod" />
                </div>
            </div>
        ) : (
            <div className="relative flex flex-col items-center justify-center w-full h-full flex-1">
                {rioState !== RioState.IDLE && (
                    <div className="absolute top-4 right-20 z-40 hidden landscape:block animate-fade-in-slow transition-opacity duration-500">
                        <Clock variant="chat" />
                    </div>
                )}

                <main 
                    className="flex flex-col landscape:flex-row items-center justify-center w-full max-w-screen-xl mx-auto gap-4 landscape:gap-8 flex-1"
                    style={{
                        transform: `translate(${pixelOffset.x}px, ${pixelOffset.y}px)`,
                        transition: 'transform 2s ease-in-out'
                    }}
                >
                    <div className={`w-full landscape:w-1/2 flex flex-col items-center justify-center ${isTvFullscreen ? 'hidden' : ''}`}>
                        <div className="h-24 flex items-end pb-4 landscape:hidden">
                            {(rioState === RioState.IDLE) && !currentChannel && !currentYouTubeVideo && (
                                <Clock variant="idle" location={userProfile.location} />
                            )}
                        </div>
                        
                        <RioDisplay 
                            state={rioState} 
                            speed={speed} 
                            delay={delay}
                            onClick={handleRioInteraction}
                            statusText={rioState === RioState.IDLE ? statusText : undefined}
                        />
                    </div>

                    <div className={`w-full flex items-center justify-center landscape:h-auto landscape:max-h-[80vh] ${isTvFullscreen ? 'landscape:w-full landscape:max-h-screen h-full' : 'landscape:w-1/2'}`}>
                        {currentChannel ? (
                            <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-white animate-pulse">Đang khởi động kênh TV...</div>}>
                                <IPTVPlayer 
                                    channel={currentChannel} 
                                    isExternallyPaused={!isTvPlaying}
                                    channels={allChannels}
                                    onChannelSelect={setCurrentChannel}
                                    onClose={handleCloseTvPlayer}
                                    isTvFullscreen={isTvFullscreen}
                                    onToggleFullscreen={handleToggleTvFullscreen}
                                    volume={volume}
                                    onVolumeChange={setVolume}
                                />
                            </Suspense>
                        ) : currentYouTubeVideo ? (
                            <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-white animate-pulse">Đang mở YouTube...</div>}>
                                <YouTubePlayer 
                                    video={currentYouTubeVideo} 
                                    onClose={handleCloseYouTubePlayer} 
                                    volume={volume}
                                />
                            </Suspense>
                        ) : (
                            rioState === RioState.IDLE ? (
                                <div className="hidden landscape:flex w-full h-full items-center justify-center">
                                    <Clock variant="idle" location={userProfile.location}/>
                                </div>
                            ) : (
                                <EphemeralDisplay 
                                    transcription={currentTranscription} 
                                    statusText={isStatusState ? statusText : null}
                                    userName={userProfile.name}
                                    rioName={userProfile.rioName || 'Rio'}
                                />
                            )
                        )}
                    </div>
                </main>
            </div>
        )}
      </div>
    );
};

export default App;