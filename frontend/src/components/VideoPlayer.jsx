import { useEffect, useRef, useState } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import './VideoPlayer.css';

const VideoPlayer = ({ stream, name, isMuted, isVideoEnabled }) => {
  const videoRef = useRef(null);
  // This state is the single source of truth for visibility inside this component
  const [isEffectivelyOn, setIsEffectivelyOn] = useState(true);

  // This effect handles the stream itself
  useEffect(() => {
    if (videoRef.current && stream) {
      // Assign the stream to our persistent video element
      videoRef.current.srcObject = stream;
    }

    // For remote streams, we determine visibility by listening to the track
    if (stream && isVideoEnabled === undefined) { // Check for undefined means it's a remote stream
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        setIsEffectivelyOn(videoTrack.enabled); // Set initial state

        const handleStateChange = () => {
          setIsEffectivelyOn(videoTrack.enabled);
        };
        
        // Listen for when the remote user mutes/unmutes their video
        videoTrack.addEventListener('mute', handleStateChange);
        videoTrack.addEventListener('unmute', handleStateChange);

        return () => {
          videoTrack.removeEventListener('mute', handleStateChange);
          videoTrack.removeEventListener('unmute', handleStateChange);
        };
      } else {
        // Stream exists but has no video track
        setIsEffectivelyOn(false);
      }
    }
  }, [stream, isVideoEnabled]);

  // For the local stream, its visibility is directly controlled by the prop from the parent
  useEffect(() => {
    if (isVideoEnabled !== undefined) { // isVideoEnabled is only passed for the local user
      setIsEffectivelyOn(isVideoEnabled);
    }
  }, [isVideoEnabled]);

  return (
    <div className="video-player-container">
      {/* The video element is ALWAYS rendered but hidden via CSS */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className={`video-player ${!isEffectivelyOn ? 'video-hidden' : ''}`}
      />

      {/* The placeholder is conditionally shown on top */}
      {!isEffectivelyOn && (
        <div className="video-placeholder">
          <FaUserCircle className="placeholder-icon" />
        </div>
      )}
      
      <div className="video-player-name">{name}</div>
    </div>
  );
};

export default VideoPlayer;