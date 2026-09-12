import { memo, useEffect, useRef, useState } from 'react';
import { FaUserCircle, FaExpand, FaCompress, FaThumbtack, FaHandPaper } from 'react-icons/fa';
import './styles/VideoPlayer.css';

// Bandwidth saver: tell the parent to pause the corresponding consumer when
// the tile leaves the viewport for >1s, or when the tab is hidden.
const useVisibilityPause = (ref, onChange) => {
  useEffect(() => {
    if (!ref.current || !onChange) return undefined;
    let timer;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            clearTimeout(timer);
            onChange(false);
          } else {
            clearTimeout(timer);
            timer = setTimeout(() => onChange(true), 1000);
          }
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(ref.current);

    const onVisibility = () => onChange(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(timer);
    };
  }, [ref, onChange]);
};

const VideoPlayer = memo(function VideoPlayer({
  stream,
  audioStream,
  name,
  isMuted,
  isVideoEnabled,
  isFullscreen,
  onToggleFullscreen,
  // Presence + bandwidth (optional).
  isActiveSpeaker,
  handRaised,
  isPinned,
  onTogglePin,
  onVisibilityChange,
  qualityLabel,
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const containerRef = useRef(null);
  const [isEffectivelyOn, setIsEffectivelyOn] = useState(true);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
    const videoTrack = stream?.getVideoTracks()[0];
    if (isVideoEnabled !== undefined) {
      setIsEffectivelyOn(isVideoEnabled);
      return undefined;
    }
    if (videoTrack) {
      const onChange = () => setIsEffectivelyOn(videoTrack.enabled && !videoTrack.muted);
      onChange();
      videoTrack.addEventListener('mute', onChange);
      videoTrack.addEventListener('unmute', onChange);
      return () => {
        videoTrack.removeEventListener('mute', onChange);
        videoTrack.removeEventListener('unmute', onChange);
      };
    }
    setIsEffectivelyOn(false);
    return undefined;
  }, [stream, isVideoEnabled]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = audioStream || null;
  }, [audioStream]);

  useVisibilityPause(containerRef, onVisibilityChange);

  const cls = [
    'video-player-container',
    isFullscreen ? 'fullscreen' : '',
    isActiveSpeaker ? 'active-speaker' : '',
    isPinned ? 'pinned' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={containerRef} className={cls} data-video-on={isEffectivelyOn}>
      <video ref={videoRef} autoPlay playsInline muted={isMuted || !!audioStream} className="video-player" />
      <div className="video-placeholder">
        <FaUserCircle className="placeholder-icon" />
      </div>

      {audioStream?.active && <audio ref={audioRef} autoPlay muted={isMuted} />}

      {handRaised && (
        <div className="video-badge video-badge-hand" title="Hand raised">
          <FaHandPaper />
        </div>
      )}

      {qualityLabel && (
        <div
          className={`video-badge video-badge-quality video-badge-quality-${qualityLabel}`}
          title={`Network: ${qualityLabel}`}
        >
          {qualityLabel === 'good' ? '\u25CF\u25CF\u25CF' : qualityLabel === 'fair' ? '\u25CF\u25CF\u25CB' : '\u25CF\u25CB\u25CB'}
        </div>
      )}

      <div className="video-player-overlay">
        <span className="video-player-name">{name}</span>
        <div className="video-player-actions">
          {onTogglePin && (
            <button
              className={`video-player-btn ${isPinned ? 'active' : ''}`}
              onClick={onTogglePin}
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              <FaThumbtack />
            </button>
          )}
          {onToggleFullscreen && (
            <button
              className="video-player-btn"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <FaCompress /> : <FaExpand />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;
