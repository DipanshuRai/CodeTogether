import { useEffect, useRef, useState } from 'react';
import { FaUserCircle, FaExpand, FaCompress } from 'react-icons/fa';
import './styles/VideoPlayer.css';

const VideoPlayer = ({
  stream,
  audioStream,
  name,
  isMuted,
  isVideoEnabled,
  isFullscreen,
  onToggleFullscreen
}) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [isEffectivelyOn, setIsEffectivelyOn] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
    const videoTrack = stream?.getVideoTracks()[0];
    if (isVideoEnabled !== undefined) {
      setIsEffectivelyOn(isVideoEnabled);
      return;
    }
    
    if (videoTrack) {
      const handleStateChange = () => {
        setIsEffectivelyOn(videoTrack.enabled && !videoTrack.muted);
      };

      handleStateChange(); // Set initial state

      videoTrack.addEventListener('mute', handleStateChange);
      videoTrack.addEventListener('unmute', handleStateChange);

      return () => {
        videoTrack.removeEventListener('mute', handleStateChange);
        videoTrack.removeEventListener('unmute', handleStateChange);
      };
    } else {
      setIsEffectivelyOn(false);
    }

  }, [stream, isVideoEnabled]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = audioStream || null;
    }
  }, [audioStream]);

  return (
    <div 
      className={`video-player-container ${isFullscreen ? 'fullscreen' : ''}`}
      data-video-on={isEffectivelyOn}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted || !!audioStream}
        className="video-player"
      />

      <div className="video-placeholder">
        <FaUserCircle className="placeholder-icon" />
      </div>
      
      {audioStream?.active && <audio ref={audioRef} autoPlay muted={isMuted} />}
      
      <div className="video-player-overlay">
        <span className="video-player-name">{name}</span>
        {onToggleFullscreen && (
          <button className="video-player-btn" onClick={onToggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;