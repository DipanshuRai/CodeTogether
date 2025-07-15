import { useEffect, useRef, useState } from 'react';
import { FaUserCircle, FaExpand, FaCompress } from 'react-icons/fa';
import './VideoPlayer.css';

const VideoPlayer = ({
  stream,
  audioStream,
  name,
  isMuted,
  isVideoEnabled, // For local player only
  isFullscreen,
  onToggleFullscreen
}) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [isEffectivelyOn, setIsEffectivelyOn] = useState(true);

  // This effect handles the video stream and remote track state
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }

    const videoTrack = stream?.getVideoTracks()[0];

    // For remote streams, visibility is determined by track mute/unmute events
    if (stream && isVideoEnabled === undefined && videoTrack) {
        const handleStateChange = () => {
            // A paused producer track will have enabled=true, but muted=true
            // A disabled track will have enabled=false
            setIsEffectivelyOn(videoTrack.enabled && !videoTrack.muted);
        };
        
        handleStateChange(); // Set initial state
        
        videoTrack.addEventListener('mute', handleStateChange);
        videoTrack.addEventListener('unmute', handleStateChange);

        return () => {
            videoTrack.removeEventListener('mute', handleStateChange);
            videoTrack.removeEventListener('unmute', handleStateChange);
        };
    } else if (!videoTrack) {
        setIsEffectivelyOn(false);
    }
  }, [stream, isVideoEnabled]);

  // For the local stream, visibility is directly controlled by the prop from the parent
  useEffect(() => {
    if (isVideoEnabled !== undefined) {
      setIsEffectivelyOn(isVideoEnabled);
    }
  }, [isVideoEnabled]);

  // Effect to handle the separate audio stream
  useEffect(() => {
    if (audioRef.current && audioStream) {
      audioRef.current.srcObject = audioStream;
    }
  }, [audioStream]);


  return (
    <div className={`video-player-container ${isFullscreen ? 'fullscreen' : ''}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted || !!audioStream} // Mute video element if audio is handled separately
        className={`video-player ${!isEffectivelyOn ? 'video-hidden' : ''}`}
      />

      {!isEffectivelyOn && (
        <div className="video-placeholder">
          <FaUserCircle className="placeholder-icon" />
        </div>
      )}
      
      {/* FIX: Added check for audioStream.active before rendering */}
      {audioStream?.active && <audio ref={audioRef} autoPlay muted={isMuted} />}
      
      <div className="video-player-overlay">
        <div className="video-player-name">{name}</div>
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