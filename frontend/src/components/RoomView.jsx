import { useState } from 'react';
import VideoPlayer from './VideoPlayer';
import './styles/RoomView.css'

const RoomView = ({ myStream, screenStream, remoteStreams, users, auth, isVideoEnabled }) => {
  const [fullscreenStream, setFullscreenStream] = useState(null);

  const toggleFullscreen = (stream, name, type) => {
    setFullscreenStream(prev => (prev?.stream === stream ? null : { stream, name, type }));
  };

  const remoteUserElements = users.map(user => {
    const userStreams = remoteStreams[user.id] || {};
    const userName = user.name;
    if (!userStreams.video && !userStreams.screen) return null;

    return (
      <div key={user.id} className="remote-user-container">
        {userStreams.screen && (
          <VideoPlayer 
            stream={userStreams.screen} 
            name={`${userName}'s Screen`} 
            onToggleFullscreen={() => toggleFullscreen(userStreams.screen, `${userName}'s Screen`, 'screen')} 
          />
        )}
        {userStreams.video && (
          <VideoPlayer 
            stream={userStreams.video} 
            audioStream={userStreams.audio} 
            name={userName} 
            onToggleFullscreen={() => toggleFullscreen(userStreams.video, userName, 'video')} 
          />
        )}
      </div>
    );
  });

  if (fullscreenStream) {
    return (
      <div className="fullscreen-container">
        <div className="fullscreen-main-video">
          <VideoPlayer 
            stream={fullscreenStream.stream} 
            name={fullscreenStream.name} 
            isFullscreen={true} 
            onToggleFullscreen={() => setFullscreenStream(null)} 
          />
        </div>
        <div className="fullscreen-thumbnails">
          <VideoPlayer 
            stream={myStream} 
            name={`${auth?.user?.fullname} (You)`} 
            isMuted={true} 
            isVideoEnabled={isVideoEnabled}
            onToggleFullscreen={() => toggleFullscreen(myStream, `${auth?.user?.fullname} (You)`, 'video')} 
          />
          {screenStream && (
            <VideoPlayer 
              stream={screenStream} 
              name="Your Screen" 
              isMuted={true} 
              onToggleFullscreen={() => toggleFullscreen(screenStream, "Your Screen", 'screen')} 
            />
          )}
          {remoteUserElements}
        </div>
      </div>
    );
  }

  return (
    <div className="users-panel">
      <div className="my-video-container">
        <VideoPlayer 
          stream={myStream} 
          name={`${auth?.user?.fullname} (You)`} 
          isMuted={true} 
          isVideoEnabled={isVideoEnabled}
          onToggleFullscreen={() => toggleFullscreen(myStream, `${auth?.user?.fullname} (You)`, 'video')} 
        />
        {screenStream && (
          <VideoPlayer 
            stream={screenStream} 
            name="Your Screen" 
            isMuted={true}
            onToggleFullscreen={() => toggleFullscreen(screenStream, "Your Screen", 'screen')} 
          />
        )}
      </div>
      <div className="remote-videos-grid">{remoteUserElements}</div>
    </div>
  );
};

export default RoomView;