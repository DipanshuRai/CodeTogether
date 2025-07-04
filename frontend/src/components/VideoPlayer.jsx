import { useEffect, useRef } from 'react';
import './VideoPlayer.css';

const VideoPlayer = ({ stream, name, isMuted }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-player-container">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="video-player"
      />
      <div className="video-player-name">{name}</div>
    </div>
  );
};

export default VideoPlayer;