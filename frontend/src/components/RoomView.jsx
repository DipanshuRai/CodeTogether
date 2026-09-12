import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import VideoPlayer from './VideoPlayer';
import './styles/RoomView.css';

// Coarse quality label derived from getStats(). Polled every 4s per visible tile.
const useQualityLabels = (peerIds, getConsumerStats) => {
  const [labels, setLabels] = useState({});
  useEffect(() => {
    if (!peerIds.length || !getConsumerStats) return undefined;
    let cancelled = false;
    const poll = async () => {
      const next = {};
      for (const pid of peerIds) {
        try {
          const stats = await getConsumerStats(pid, 'video');
          if (!stats) continue;
          let loss = 0;
          let received = 0;
          let jitter = 0;
          stats.forEach((r) => {
            if (r.type === 'inbound-rtp' && r.kind === 'video') {
              loss = r.packetsLost ?? loss;
              received = r.packetsReceived ?? received;
              jitter = r.jitter ?? jitter;
            }
          });
          const lossRate = received > 0 ? loss / (loss + received) : 0;
          next[pid] = (lossRate < 0.02 && jitter < 0.05) ? 'good'
            : (lossRate < 0.08 && jitter < 0.2) ? 'fair' : 'poor';
        } catch { /* ignore */ }
      }
      if (!cancelled) setLabels(next);
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, [peerIds.join('|'), getConsumerStats]); // eslint-disable-line react-hooks/exhaustive-deps
  return labels;
};

const RoomView = ({
  myStream,
  screenStream,
  remoteStreams,
  users,
  auth,
  isVideoEnabled,
  activeSpeakerId,
  raisedHands,
  pinnedPeerId,
  onTogglePin,
  onPeerVisibilityChange,
  getConsumerStats,
}) => {
  const [fullscreenInfo, setFullscreenInfo] = useState(null);
  const fullscreenContainerRef = useRef(null);

  const peerIds = useMemo(() => users.map(u => u.id), [users]);
  const qualityLabels = useQualityLabels(peerIds, getConsumerStats);

  const allStreams = useMemo(() => {
    const list = [
      {
        stream: myStream,
        audioStream: null,
        name: `${auth?.user?.fullname} (You)`,
        type: 'video',
        isMuted: true,
        isVideoEnabled,
        peerId: 'self',
      },
    ];
    if (screenStream) {
      list.push({
        stream: screenStream, audioStream: null, name: 'Your Screen',
        type: 'screen', isMuted: true, isVideoEnabled: true, peerId: 'self-screen',
      });
    }
    users.forEach(user => {
      const userStreams = remoteStreams[user.id] || {};
      list.push({
        stream: userStreams.video || null,
        audioStream: userStreams.audio || null,
        name: user.name,
        type: 'video',
        isMuted: false,
        isVideoEnabled: !!userStreams.video?.getVideoTracks()[0]?.enabled,
        peerId: user.id,
      });
      if (userStreams.screen) {
        list.push({
          stream: userStreams.screen, audioStream: null,
          name: `${user.name}'s Screen`, type: 'screen',
          isMuted: true, isVideoEnabled: true,
          peerId: `${user.id}-screen`,
        });
      }
    });
    return list.filter(Boolean);
  }, [myStream, screenStream, remoteStreams, users, auth, isVideoEnabled]);

  // If a peer is pinned, render that tile as fullscreen-main.
  const effectiveFullscreen = useMemo(() => {
    if (fullscreenInfo) return fullscreenInfo;
    if (!pinnedPeerId) return null;
    return allStreams.find(s => s.peerId === pinnedPeerId) || null;
  }, [fullscreenInfo, pinnedPeerId, allStreams]);

  const handleToggleFullscreen = (info) => {
    if (document.fullscreenElement) {
      if (fullscreenInfo?.stream !== info.stream) setFullscreenInfo(info);
      else document.exitFullscreen();
    } else {
      setFullscreenInfo(info);
    }
  };

  const syncFullscreenState = useCallback(() => {
    if (!document.fullscreenElement) setFullscreenInfo(null);
  }, []);

  useEffect(() => {
    if (fullscreenInfo && !document.fullscreenElement && fullscreenContainerRef.current) {
      fullscreenContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Fullscreen failed: ${err.message}`);
        setFullscreenInfo(null);
      });
    }
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, [fullscreenInfo, syncFullscreenState]);

  const renderVideoPlayer = (info) => {
    const isFs = effectiveFullscreen?.stream === info.stream;
    const peerSocketId = info.peerId.replace(/-screen$/, '');
    const isRemote = info.peerId !== 'self' && info.peerId !== 'self-screen';
    return (
      <VideoPlayer
        key={info.peerId + (info.type || '')}
        stream={info.stream}
        audioStream={info.audioStream}
        name={info.name}
        isMuted={info.isMuted}
        isVideoEnabled={info.isVideoEnabled}
        isFullscreen={isFs}
        onToggleFullscreen={() => handleToggleFullscreen(info)}
        isActiveSpeaker={isRemote && activeSpeakerId === peerSocketId}
        handRaised={isRemote && raisedHands?.has?.(peerSocketId)}
        isPinned={pinnedPeerId === info.peerId}
        onTogglePin={isRemote ? () => onTogglePin?.(info.peerId) : undefined}
        onVisibilityChange={isRemote && onPeerVisibilityChange
          ? (hidden) => onPeerVisibilityChange(peerSocketId, info.type === 'screen' ? 'screen' : 'video', hidden)
          : undefined}
        qualityLabel={isRemote ? qualityLabels[peerSocketId] : undefined}
      />
    );
  };

  if (effectiveFullscreen) {
    return (
      <div className="fullscreen-container" ref={fullscreenContainerRef}>
        <div className="fullscreen-main-video">{renderVideoPlayer(effectiveFullscreen)}</div>
        <div className="fullscreen-thumbnails">
          {allStreams
            .filter(s => s.stream !== effectiveFullscreen.stream)
            .map(info => (
              <div
                key={info.peerId + (info.type || '')}
                className="thumbnail-wrapper"
                onClick={() => handleToggleFullscreen(info)}
              >
                {renderVideoPlayer(info)}
              </div>
            ))}
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
