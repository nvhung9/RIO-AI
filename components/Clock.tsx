import React, { useState, useEffect } from 'react';
import * as geminiService from '../services/geminiService';
import { vietnameseQuotes } from '../services/quotesService';

interface ClockProps {
    variant: 'idle' | 'chat' | 'aod';
    location?: {
        latitude: number;
        longitude: number;
    };
}

const Clock: React.FC<ClockProps> = ({ variant, location }) => {
    const [date, setDate] = useState(new Date());
    const [weather, setWeather] = useState<geminiService.WeatherData | null>(null);
    const [weatherError, setWeatherError] = useState<string | null>(null);
    const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * vietnameseQuotes.length));

    useEffect(() => {
        const timerId = setInterval(() => setDate(new Date()), 1000);

        const fetchWeather = async () => {
            if (!location) return;
            try {
                setWeatherError(null);
                const data = await geminiService.getWeatherForLocation(location.latitude, location.longitude);
                setWeather(data);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Lỗi thời tiết không xác định";
                setWeatherError(message);
                console.error("Lỗi lấy dữ liệu thời tiết:", error);
            }
        };

        // FIX: Use `any` for interval IDs to avoid type conflicts between Node.js (`Timeout`) and browser (`number`) environments.
        let weatherIntervalId: any = null;
        let quoteRotationIntervalId: any = null;

        if (variant === 'idle' || variant === 'aod') {
            fetchWeather(); // Fetch immediately on entering the state
            const weatherIntervalDuration = 1000 * 60 * 60; // 60 minutes for both Idle and AOD
            weatherIntervalId = window.setInterval(fetchWeather, weatherIntervalDuration);
        }

        if (variant === 'idle') {
            // Rotate to a new random quote in the local list every minute
            quoteRotationIntervalId = setInterval(() => {
                setQuoteIndex(prevIndex => {
                    let nextIndex = prevIndex;
                    // Ensure the next quote is different from the current one.
                    while (nextIndex === prevIndex) {
                        nextIndex = Math.floor(Math.random() * vietnameseQuotes.length);
                    }
                    return nextIndex;
                });
            }, 1000 * 60); // Rotate quote every minute
        }

        return () => {
            clearInterval(timerId);
            if (weatherIntervalId) clearInterval(weatherIntervalId);
            if (quoteRotationIntervalId) clearInterval(quoteRotationIntervalId);
        };
    }, [variant, location]);

    const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
    
    const shortDateFormatter = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short',
        day: 'numeric',
        month: 'numeric'
    });

    if (variant === 'chat') {
        return (
            <div className="text-right text-white">
                <h1 className="text-2xl font-semibold tracking-wide">
                    {timeFormatter.format(date)}
                </h1>
                <p className="text-xs text-gray-400 capitalize">
                    {shortDateFormatter.format(date)}
                </p>
            </div>
        );
    }

    if (variant === 'aod') {
        return (
            <div className="text-center">
                <h1 className="text-8xl md:text-9xl font-bold text-gray-800 tracking-wider">
                    {timeFormatter.format(date)}
                </h1>
                <p className="text-2xl md:text-3xl font-medium text-gray-700 capitalize tracking-wide mt-2">
                    {dateFormatter.format(date)}
                </p>
                {weather && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-xl text-gray-700 animate-fade-in">
                        <span className="text-3xl">{weather.emoji}</span>
                        <span>{Math.round(weather.temperature)}°C</span>
                        <span className="hidden sm:inline">{weather.condition}</span>
                    </div>
                )}
                {weatherError && !weather && (
                    <p className="mt-4 text-base text-yellow-800 animate-fade-in">{weatherError}</p>
                )}
            </div>
        );
    }

    const currentQuote = vietnameseQuotes[quoteIndex];

    return (
        <div className="text-center text-white animate-fade-in-slow">
            <h1 
                className="text-8xl md:text-9xl font-bold tracking-wider"
                style={{ textShadow: '0 0 15px rgba(255, 255, 255, 0.3), 0 0 5px rgba(255, 255, 255, 0.2)' }}
            >
                {timeFormatter.format(date)}
            </h1>
            <p className="text-2xl md:text-3xl font-medium text-gray-300 capitalize tracking-wide mt-2">
                {dateFormatter.format(date)}
            </p>

            {weather && (
                <div className="mt-4 flex items-center justify-center gap-3 text-xl md:text-2xl text-gray-300 animate-fade-in">
                    <span className="text-4xl">{weather.emoji}</span>
                    <span>{Math.round(weather.temperature)}°C</span>
                    <span>{weather.condition}</span>
                </div>
            )}
            {weatherError && !weather && (
                 <p className="mt-4 text-sm text-yellow-400 animate-fade-in">{weatherError}</p>
            )}

            {currentQuote && (
                <div className="mt-6 text-lg md:text-xl text-gray-400 italic animate-fade-in px-4 max-w-2xl mx-auto">
                    <p>"{currentQuote}"</p>
                </div>
            )}

            <style>{`
                @keyframes fadeInSlow {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-slow {
                    animation: fadeInSlow 1.2s ease-out forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fadeIn 1s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default Clock;