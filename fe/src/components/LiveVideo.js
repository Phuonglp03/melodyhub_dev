import React, { useEffect, useState } from 'react';

/**
 * Live Indicator Component
 * Shows a red circle when live (at edge), gray when delayed 5+ seconds
 * Clicking returns to live edge
 */
const LiveVideo = ({ player, style = {} }) => {
  const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);
  const [behindSeconds, setBehindSeconds] = useState(0);

  useEffect(() => {
    if (!player) return;

    const checkLiveStatus = () => {
      try {
        const liveTracker = player.liveTracker;
        if (!liveTracker) return;

        const seekableEnd = liveTracker.seekableEnd();
        const currentTime = player.currentTime();
        const behind = seekableEnd - currentTime;

        setBehindSeconds(Math.floor(behind));
        
        // Consider "at live edge" if within 5 seconds
        setIsAtLiveEdge(behind < 5);
      } catch (error) {
        console.error('[LiveVideo] Error checking live status:', error);
      }
    };

    // Check immediately
    checkLiveStatus();

    // Check every second
    const interval = setInterval(checkLiveStatus, 1000);

    // Also listen to player events
    player.on('timeupdate', checkLiveStatus);
    player.on('seeked', checkLiveStatus);

    return () => {
      clearInterval(interval);
      if (player) {
        player.off('timeupdate', checkLiveStatus);
        player.off('seeked', checkLiveStatus);
      }
    };
  }, [player]);

  const handleGoLive = () => {
    if (!player) return;
    
    try {
      const liveTracker = player.liveTracker;
      if (liveTracker && liveTracker.seekToLiveEdge) {
        liveTracker.seekToLiveEdge();
        setIsAtLiveEdge(true);
        setBehindSeconds(0);
      }
    } catch (error) {
      console.error('[LiveVideo] Error seeking to live:', error);
    }
  };

  return (
    <button
      onClick={handleGoLive}
      style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: isAtLiveEdge 
          ? 'rgba(255, 0, 0, 0.9)' 
          : 'rgba(128, 128, 128, 0.9)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer',
        zIndex: 1000,
        transition: 'all 0.3s ease',
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <div style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: isAtLiveEdge ? '#fff' : '#ccc',
        animation: isAtLiveEdge ? 'pulse 2s infinite' : 'none'
      }}></div>
      <span>
        {isAtLiveEdge 
          ? 'TRỰC TIẾP' 
          : `Chậm ${behindSeconds}s - Nhấn để trực tiếp`}
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </button>
  );
};

export default LiveVideo;

