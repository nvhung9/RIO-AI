import React, { useState, useEffect } from 'react';
import { RioState, IdleExpression } from '../types';
import {
  NormalRio,
  BlinkRio,
  LookLeftRio,
  LookRightRio,
  HappyRio,
  ListeningRio,
  ThinkingRio,
  SpeakingRio,
  LoadingRio,
  ErrorRio,
  SadRio,
  SurprisedRio,
  SquintRio,
  WinkLeftRio,
  LoveRio,
  DizzyRio,
  AngryRio,
  ConfusedRio,
  SleepyRio,
  SleepingRio,
  ProudRio,
  KawaiiRio,
  DeepSleepRio
} from './RioExpressions';

interface RioDisplayProps {
  state: RioState;
  speed: number;
  delay: number;
  onClick?: () => void;
  statusText?: string;
}

const RioDisplay: React.FC<RioDisplayProps> = ({ state, speed, delay, onClick, statusText }) => {
  const [idleExpression, setIdleExpression] = useState<IdleExpression>(IdleExpression.NORMAL);

  useEffect(() => {
    if (state === RioState.IDLE) {
      // Create a weighted pool to make some expressions more common and give Rio more personality.
      const idleExpressionPool = [
        IdleExpression.NORMAL, IdleExpression.NORMAL, IdleExpression.NORMAL, IdleExpression.NORMAL, IdleExpression.NORMAL,
        IdleExpression.BLINK, IdleExpression.BLINK, IdleExpression.BLINK,
        IdleExpression.HAPPY, IdleExpression.HAPPY, // Make Happy more frequent
        IdleExpression.LOOK_LEFT,
        IdleExpression.LOOK_RIGHT,
        IdleExpression.SQUINT,
        IdleExpression.WINK_LEFT,
        IdleExpression.KAWAII,
        IdleExpression.SLEEPY,
        IdleExpression.CONFUSED,
        IdleExpression.PROUD,
        IdleExpression.SURPRISED,
        IdleExpression.LOVE,
        IdleExpression.DIZZY,
        IdleExpression.SLEEPING,
      ];

      const idleAnimation = setInterval(() => {
        const nextExpression = idleExpressionPool[Math.floor(Math.random() * idleExpressionPool.length)];
        
        // Avoid setting the same expression back-to-back to make it feel more dynamic
        setIdleExpression(current => current === nextExpression ? IdleExpression.NORMAL : nextExpression);
      }, delay);
      return () => clearInterval(idleAnimation);
    }
  }, [state, delay]);
  
  const rioProps = { speed };

  const renderIdleRio = () => {
    switch (idleExpression) {
      case IdleExpression.BLINK:
        return <BlinkRio {...rioProps} />;
      case IdleExpression.LOOK_LEFT:
        return <LookLeftRio {...rioProps} />;
      case IdleExpression.LOOK_RIGHT:
        return <LookRightRio {...rioProps} />;
      case IdleExpression.HAPPY:
          return <HappyRio {...rioProps} />;
      case IdleExpression.SAD:
        return <SadRio {...rioProps} />;
      case IdleExpression.SURPRISED:
        return <SurprisedRio {...rioProps} />;
      case IdleExpression.SQUINT:
        return <SquintRio {...rioProps} />;
      case IdleExpression.WINK_LEFT:
        return <WinkLeftRio {...rioProps} />;
      case IdleExpression.LOVE:
        return <LoveRio {...rioProps} />;
      case IdleExpression.DIZZY:
        return <DizzyRio {...rioProps} />;
      case IdleExpression.ANGRY:
        return <AngryRio {...rioProps} />;
      case IdleExpression.CONFUSED:
        return <ConfusedRio {...rioProps} />;
      case IdleExpression.SLEEPY:
        return <SleepyRio {...rioProps} />;
      case IdleExpression.SLEEPING:
        return <SleepingRio {...rioProps} />;
      case IdleExpression.PROUD:
        return <ProudRio {...rioProps} />;
      case IdleExpression.KAWAII:
        return <KawaiiRio {...rioProps} />;
      case IdleExpression.NORMAL:
      default:
        return <NormalRio {...rioProps} />;
    }
  };

  const renderRio = () => {
    switch (state) {
      case RioState.IDLE:
        const idleRio = renderIdleRio();
        return React.cloneElement(idleRio, { isIdle: true });
      case RioState.LISTENING:
        return <ListeningRio {...rioProps} />;
      case RioState.THINKING:
        return <ThinkingRio {...rioProps} />;
      case RioState.SPEAKING:
        return <SpeakingRio {...rioProps} />;
      case RioState.LOADING:
        return <LoadingRio {...rioProps} />;
      case RioState.ENTERING_DEEP_SLEEP:
        return <DeepSleepRio {...rioProps} />;
      case RioState.ERROR:
        return <ErrorRio {...rioProps} />;
      case RioState.HAPPY:
        return <HappyRio {...rioProps} />;
      case RioState.SAD:
        return <SadRio {...rioProps} />;
      case RioState.ANGRY:
        return <AngryRio {...rioProps} />;
      case RioState.CONFUSED:
        return <ConfusedRio {...rioProps} />;
      default:
        return <NormalRio {...rioProps} />;
    }
  };

  return (
    <div 
      className="flex flex-col items-center justify-center cursor-pointer"
      onClick={onClick}
    >
      <div className="w-64 h-64 md:w-80 md:h-80">
        {renderRio()}
      </div>

      {/* Placeholder for text to prevent layout shift */}
      <div className="min-h-[2rem] flex flex-col items-center justify-center" aria-live="polite"> 
        {state === RioState.LISTENING && (
          <>
            <p className="text-sm font-medium text-gray-400 uppercase tracking-wider animate-pulse-subtle">
              đang lắng nghe
            </p>
            <style>{`
              @keyframes pulse-subtle {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
              }
              .animate-pulse-subtle {
                animation: pulse-subtle 2s ease-in-out infinite;
              }
            `}</style>
          </>
        )}
        {state === RioState.IDLE && statusText && (
          <p className="text-xs font-medium text-gray-500 text-center px-2">
            {statusText}
          </p>
        )}
        {/* Debug: Hiển thị trạng thái hiện tại */}
        <p className="text-[10px] font-mono text-gray-600/70 mt-0.5">
          [{state}]
        </p>
      </div>
    </div>
  );
};

export default RioDisplay;