import { useState } from 'react';
import VideoPlayer from './VideoPlayer';
import './styles/RoomView.css';

const RoomView = ({ myStream, screenStream, remoteStreams, users, auth, isVideoEnabled }) => {
  const [fullscreenInfo, setFullscreenInfo] = useState(null);

  const handleToggleFullscreen = (stream, name, type) => {
    setFullscreenInfo(prev => (prev?.stream === stream ? null : { stream, name, type }));
  };

  const renderVideoPlayer = (info, isThumbnail = false) => {
    const { stream, name, type, ...props } = info;
    return (
      <VideoPlayer
        key={name}
        stream={stream}
        name={name}
        isFullscreen={!isThumbnail && !!fullscreenInfo}
        onToggleFullscreen={() => handleToggleFullscreen(stream, name, type)}
        {...props}
      />
    );
  };
  
  const allStreams = [
    { stream: myStream, name: `${auth?.user?.fullname} (You)`, type: 'video', isMuted: true, isVideoEnabled },
    screenStream && { stream: screenStream, name: "Your Screen", type: 'screen', isMuted: true },
    ...users.flatMap(user => {
      const userStreams = remoteStreams[user.id] || {};
      const userName = user.name;
      return [
        userStreams.video && { stream: userStreams.video, audioStream: userStreams.audio, name: userName, type: 'video' },
        userStreams.screen && { stream: userStreams.screen, name: `${userName}'s Screen`, type: 'screen' }
      ].filter(Boolean);
    })
  ].filter(Boolean);

  const mainView = (
    <div className="users-panel">
      <div className="my-video-container">
        {renderVideoPlayer(allStreams[0])}
        {screenStream && renderVideoPlayer(allStreams[1])}
      </div>
      <div className="remote-videos-grid">
        {users.map(user => {
          const userStreams = remoteStreams[user.id] || {};
          const userName = user.name;
          return (
            <div key={user.id} className="remote-user-container">
              {userStreams.screen && 
                renderVideoPlayer({ stream: userStreams.screen, name: `${userName}'s Screen`, type: 'screen' })
              }
              <VideoPlayer 
                stream={userStreams.video} 
                audioStream={userStreams.audio} 
                name={userName} 
                onToggleFullscreen={() => handleToggleFullscreen(userStreams.video, userName, 'video')} 
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {mainView}
      {fullscreenInfo && (
        <div className="fullscreen-container">
          <div className="fullscreen-main-video">
            {renderVideoPlayer(fullscreenInfo)}
          </div>
          <div className="fullscreen-thumbnails">
            {allStreams
              .filter(s => s.stream !== fullscreenInfo.stream)
              .map(info => renderVideoPlayer(info, true))
            }
          </div>
        </div>
      )}
    </>
  );
};

export default RoomView;