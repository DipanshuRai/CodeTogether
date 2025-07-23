import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import VideoPlayer from './VideoPlayer';
import './styles/RoomView.css';

const RoomView = ({ myStream, screenStream, remoteStreams, users, auth, isVideoEnabled }) => {
  const [fullscreenInfo, setFullscreenInfo] = useState(null);
  const fullscreenContainerRef = useRef(null);

  const allStreams = useMemo(() => {
    const streamList = [
      { stream: myStream, audioStream: null, name: `${auth?.user?.fullname} (You)`, type: 'video', isMuted: true, isVideoEnabled },
    ];
    if (screenStream) {
      streamList.push({ stream: screenStream, audioStream: null, name: "Your Screen", type: 'screen', isMuted: true, isVideoEnabled: true });
    }
    users.forEach(user => {
      const userStreams = remoteStreams[user.id] || {};
      const userName = user.name;
      streamList.push({ 
        stream: userStreams.video || null, 
        audioStream: userStreams.audio || null, 
        name: userName, 
        type: 'video', 
        isMuted: false, 
        isVideoEnabled: !!userStreams.video?.getVideoTracks()[0]?.enabled 
      });
      if (userStreams.screen) {
        streamList.push({ 
          stream: userStreams.screen, 
          audioStream: null, 
          name: `${userName}'s Screen`, 
          type: 'screen', 
          isMuted: true, 
          isVideoEnabled: true 
        });
      }
    });
    return streamList.filter(Boolean);
  }, [myStream, screenStream, remoteStreams, users, auth, isVideoEnabled]);

  const handleToggleFullscreen = (streamInfo) => {
    if (document.fullscreenElement) {
      if (fullscreenInfo?.stream !== streamInfo.stream) {
        setFullscreenInfo(streamInfo);
      } else {
        document.exitFullscreen();
      }
    } else {
      setFullscreenInfo(streamInfo);
    }
  };
  
  const syncFullscreenState = useCallback(() => {
    if (!document.fullscreenElement) {
      setFullscreenInfo(null);
    }
  }, []);

  useEffect(() => {
    if (fullscreenInfo && !document.fullscreenElement && fullscreenContainerRef.current) {
      fullscreenContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        setFullscreenInfo(null);
      });
    }

    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
    };
  }, [fullscreenInfo, syncFullscreenState]);

  const renderVideoPlayer = (info, isThumbnail = false) => {
    const isCurrentlyFullscreen = fullscreenInfo?.stream === info.stream;
    return (
      <VideoPlayer
        key={info.name}
        stream={info.stream}
        audioStream={info.audioStream}
        name={info.name}
        isMuted={info.isMuted}
        isVideoEnabled={info.isVideoEnabled}
        isFullscreen={isCurrentlyFullscreen}
        onToggleFullscreen={() => handleToggleFullscreen(info)}
      />
    );
  };
  
  if (fullscreenInfo) {
    return (
      <div className="fullscreen-container" ref={fullscreenContainerRef}>
        <div className="fullscreen-main-video">
          {renderVideoPlayer(fullscreenInfo)}
        </div>
        <div className="fullscreen-thumbnails">
          {allStreams
            .filter(s => s.stream !== fullscreenInfo.stream)
            .map(info => (
              <div key={info.name} className="thumbnail-wrapper" onClick={() => handleToggleFullscreen(info)}>
                {renderVideoPlayer(info, true)}
              </div>
            ))
          }
        </div>
      </div>
    );
  }

  return (
    <div className="users-panel">
      <div className="remote-videos-grid">
        {allStreams.map(info => renderVideoPlayer(info))}
      </div>
    </div>
  );
};

export default RoomView;