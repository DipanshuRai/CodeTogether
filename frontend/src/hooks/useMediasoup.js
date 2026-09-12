import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  createDevice,
  loadDevice,
  createSendTransport,
  createRecvTransport,
  consumeStream,
} from '../utils/mediasoup-client';

// Three-layer simulcast for the webcam. The SFU picks the right layer per
// consumer based on bandwidth, dramatically cutting upstream usage with 3+ peers.
const VIDEO_SIMULCAST_ENCODINGS = [
  { rid: 'r0', maxBitrate: 150_000, scaleResolutionDownBy: 4, scalabilityMode: 'S1T3' },
  { rid: 'r1', maxBitrate: 500_000, scaleResolutionDownBy: 2, scalabilityMode: 'S1T3' },
  { rid: 'r2', maxBitrate: 1_500_000, scaleResolutionDownBy: 1, scalabilityMode: 'S1T3' },
];

// Single VP9 SVC layer for screen-share: sharp text, low CPU vs simulcast.
const SCREEN_SHARE_ENCODINGS = [
  { maxBitrate: 1_500_000, scalabilityMode: 'L1T3' },
];

const VIDEO_CODEC_OPTIONS = { videoGoogleStartBitrate: 1000 };

const pickVp9Codec = (device) =>
  device?.rtpCapabilities?.codecs?.find(
    (c) => c.mimeType?.toLowerCase() === 'video/vp9'
  );

const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: 48000,
};

// Adaptive: reduce per-layer cap as the room grows / on slow networks.
const computeBitrateCap = (peerCount) => {
  let cap = 1_500_000;
  if (peerCount >= 4) cap = 900_000;
  if (peerCount >= 8) cap = 500_000;
  if (peerCount >= 12) cap = 300_000;

  const c = navigator.connection;
  if (c?.effectiveType) {
    if (c.effectiveType === '2g' || c.effectiveType === 'slow-2g') cap = Math.min(cap, 150_000);
    else if (c.effectiveType === '3g') cap = Math.min(cap, 500_000);
  }
  return cap;
};

export const useMediasoup = (socket, roomId, name, action) => {
  // Local Media State
  const [myStream, setMyStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);

  // Remote Media State
  const [remoteStreams, setRemoteStreams] = useState({});
  const [users, setUsers] = useState([]);

  // Collaboration extras
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const [raisedHands, setRaisedHands] = useState(new Set());
  const [handRaised, setHandRaised] = useState(false);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [pinnedPeerId, setPinnedPeerId] = useState(null);

  const navigate = useNavigate();

  // Refs
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef({ video: null, audio: null, screen: null });
  const consumersRef = useRef(new Map());
  const screenStreamRef = useRef(null);
  const myStreamRef = useRef(null);
  const reactionCounterRef = useRef(0);

  const handleConsumeStream = useCallback(async (producerId, socketId, kind, type) => {
    if (!deviceRef.current || !recvTransportRef.current?.id) return;
    try {
      const { consumer, stream } = await consumeStream(
        socket,
        deviceRef.current,
        recvTransportRef.current,
        producerId,
        deviceRef.current.rtpCapabilities
      );

      consumersRef.current.set(consumer.id, { consumer, socketId, kind, type });

      consumer.on('producerclose', () => {
        consumersRef.current.delete(consumer.id);
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          if (newStreams[socketId]) {
            const streamType = type === 'screen' ? 'screen' : kind;
            delete newStreams[socketId][streamType];
            if (Object.keys(newStreams[socketId]).length === 0) delete newStreams[socketId];
          }
          return newStreams;
        });
      });

      const streamType = type === 'screen' ? 'screen' : kind;
      setRemoteStreams(prev => ({
        ...prev,
        [socketId]: { ...prev[socketId], [streamType]: stream },
      }));
    } catch (error) {
      console.error(`Error consuming stream of type ${type} from ${socketId}:`, error);
    }
  }, [socket]);

  useEffect(() => {
    if (roomId === 'solo' || !socket || !name || !action) return;

    let isMounted = true;

    const initMediasoup = async () => {
      try {
        const device = createDevice();
        deviceRef.current = device;

        const routerRtpCapabilities = await new Promise(resolve =>
          socket.emit('get-router-rtp-capabilities', roomId, resolve)
        );
        await loadDevice(routerRtpCapabilities, device);

        sendTransportRef.current = await createSendTransport(socket, device, roomId);
        recvTransportRef.current = await createRecvTransport(socket, device, roomId);

        const wireIceRestart = (transport, role) => {
          transport.on('connectionstatechange', async (state) => {
            if (state === 'disconnected' || state === 'failed') {
              try {
                const iceParameters = await new Promise((resolve, reject) =>
                  socket.emit('restart-ice', { transportId: transport.id }, (resp) =>
                    resp?.iceParameters
                      ? resolve(resp.iceParameters)
                      : reject(new Error(resp?.error || 'restart-ice failed'))
                  )
                );
                await transport.restartIce({ iceParameters });
                console.log(`[mediasoup] restarted ICE on ${role} transport`);
              } catch (err) {
                console.warn(`[mediasoup] ICE restart failed on ${role}:`, err.message);
              }
            }
          });
        };
        wireIceRestart(sendTransportRef.current, 'send');
        wireIceRestart(recvTransportRef.current, 'recv');

        socket.emit('get-initial-producers', roomId, producers => {
          if (!isMounted) return;
          for (const { producerId, socketId, kind, type } of producers) {
            handleConsumeStream(producerId, socketId, kind, type);
          }
        });
      } catch (err) {
        console.error('Initialization failed:', err);
        toast.error('Media connection failed.');
      }
    };

    const handleNewProducer = ({ producerId, socketId, kind, type }) =>
      handleConsumeStream(producerId, socketId, kind, type);

    const handleProducerClosed = ({ socketId }) =>
      setRemoteStreams(prev => { const ns = { ...prev }; delete ns[socketId]; return ns; });

    const handleSpecificProducerClosed = ({ producerId }) => {
      let toDelete = null;
      for (const [consumerId, info] of consumersRef.current.entries()) {
        if (info.consumer.producerId === producerId) {
          toDelete = { consumerId, ...info };
          break;
        }
      }
      if (!toDelete) return;
      const { consumerId, consumer, socketId, kind, type } = toDelete;

      consumer.close();
      consumersRef.current.delete(consumerId);

      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        if (newStreams[socketId]) {
          const streamType = type === 'screen' ? 'screen' : kind;
          delete newStreams[socketId][streamType];
          if (Object.keys(newStreams[socketId]).length === 0) delete newStreams[socketId];
        }
        return newStreams;
      });
    };

    const handleUserListUpdate = userList => setUsers(userList.filter(u => u.id !== socket.id));
    const handleNewUser = ({ name }) => toast(`${name} joined the room.`);
    const handleUserLeft = ({ name, socketId }) => {
      toast(`${name} left the room.`);
      setRaisedHands(prev => {
        if (!prev.has(socketId)) return prev;
        const next = new Set(prev);
        next.delete(socketId);
        return next;
      });
      setPinnedPeerId(prev => (prev === socketId ? null : prev));
    };
    const handleActiveSpeaker = ({ socketId }) => setActiveSpeakerId(socketId);
    const handleSilence = () => setActiveSpeakerId(null);
    const handleChatMessage = (msg) => setMessages(prev => [...prev, msg].slice(-200));
    const handleRaiseHand = ({ socketId, raised }) =>
      setRaisedHands(prev => {
        const next = new Set(prev);
        if (raised) next.add(socketId); else next.delete(socketId);
        return next;
      });
    const handleReaction = ({ socketId, emoji, name: from }) => {
      const id = ++reactionCounterRef.current;
      setReactions(prev => [...prev, { id, socketId, emoji, name: from }]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3500);
    };

    socket.on('new-producer', handleNewProducer);
    socket.on('producer-closed', handleProducerClosed);
    socket.on('specific-producer-closed', handleSpecificProducerClosed);
    socket.on('update-user-list', handleUserListUpdate);
    socket.on('user-joined', handleNewUser);
    socket.on('user-left', handleUserLeft);
    socket.on('active-speaker', handleActiveSpeaker);
    socket.on('active-speaker-silence', handleSilence);
    socket.on('chat-message', handleChatMessage);
    socket.on('raise-hand', handleRaiseHand);
    socket.on('reaction', handleReaction);

    const eventToEmit = action === 'create' ? 'create-room' : 'join-room';

    socket.emit(eventToEmit, roomId, name, (response) => {
      if (!isMounted) return;
      if (response.success) {
        toast.success(response.message);
        setUsers(response.users.filter(u => u.id !== socket.id));
        initMediasoup();
      } else {
        toast.error(response.message);
        navigate('/');
      }
    });

    return () => {
      isMounted = false;
      myStreamRef.current?.getTracks().forEach(track => track.stop());
      myStreamRef.current = null;
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      sendTransportRef.current = null;
      recvTransportRef.current = null;
      consumersRef.current.clear();
      producersRef.current = { video: null, audio: null, screen: null };

      socket.off('new-producer', handleNewProducer);
      socket.off('producer-closed', handleProducerClosed);
      socket.off('specific-producer-closed', handleSpecificProducerClosed);
      socket.off('update-user-list', handleUserListUpdate);
      socket.off('user-joined', handleNewUser);
      socket.off('user-left', handleUserLeft);
      socket.off('active-speaker', handleActiveSpeaker);
      socket.off('active-speaker-silence', handleSilence);
      socket.off('chat-message', handleChatMessage);
      socket.off('raise-hand', handleRaiseHand);
      socket.off('reaction', handleReaction);

      if (roomId !== 'solo') socket.emit('leave-room');
    };
  }, [socket, roomId, name, action, handleConsumeStream, navigate]);

  // Adaptive bitrate whenever the peer count changes.
  useEffect(() => {
    const videoProducer = producersRef.current.video;
    if (!videoProducer) return;
    const cap = computeBitrateCap(users.length + 1);
    const sender = videoProducer.rtpSender;
    if (!sender || !sender.getParameters) return;
    try {
      const params = sender.getParameters();
      if (!params.encodings) return;
      params.encodings = params.encodings.map((enc, i) => ({
        ...enc,
        // Top layer gets the cap; lower layers scaled down geometrically.
        maxBitrate: Math.min(enc.maxBitrate ?? cap, Math.round(cap / Math.pow(2, params.encodings.length - 1 - i))),
      }));
      sender.setParameters(params).catch(() => {});
    } catch { /* ignore */ }
  }, [users.length]);

  const toggleScreenShare = useCallback(async () => {
    if (!sendTransportRef.current) return toast.error('Media server not connected.');

    const stopSharing = ({ silent = false } = {}) => {
      const screenProducer = producersRef.current.screen;
      if (screenProducer) {
        socket.emit('close-producer', { producerId: screenProducer.id });
        screenProducer.close();
      }
      producersRef.current.screen = null;
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsScreenSharing(false);
      if (!silent) toast.success('Screen sharing stopped');
    };

    if (isScreenSharing) {
      stopSharing();
    } else {
      try {
        const captureStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30, max: 60 } },
          audio: false,
        });
        const screenTrack = captureStream.getVideoTracks()[0];
        if (!screenTrack) throw new Error('No video track found');

        screenTrack.addEventListener('ended', () => {
          stopSharing({ silent: true });
          toast('Screen sharing ended');
        });

        screenStreamRef.current = captureStream;
        setScreenStream(captureStream);

        const vp9 = pickVp9Codec(deviceRef.current);
        const screenProducer = await sendTransportRef.current.produce({
          track: screenTrack,
          encodings: SCREEN_SHARE_ENCODINGS,
          codecOptions: { videoGoogleStartBitrate: 1500 },
          ...(vp9 ? { codec: vp9 } : {}),
          appData: { type: 'screen' },
        });
        producersRef.current.screen = screenProducer;
        setIsScreenSharing(true);
        toast.success('Screen sharing started');
      } catch (error) {
        if (error.name !== 'NotAllowedError') toast.error('Could not start screen sharing');
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        setScreenStream(null);
      }
    }
  }, [isScreenSharing, socket]);

  const toggleMedia = useCallback(async (mediaType) => {
    if (!sendTransportRef.current) {
      toast.error('Media connection is not yet available.');
      return;
    }

    const producer = producersRef.current[mediaType];
    const isEnabling = !producer;

    if (isEnabling) {
      try {
        const constraints = mediaType === 'audio'
          ? { audio: AUDIO_CONSTRAINTS }
          : { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const track = stream.getTracks()[0];

        const produceOpts = { track, appData: { type: mediaType } };
        if (mediaType === 'video') {
          produceOpts.encodings = VIDEO_SIMULCAST_ENCODINGS;
          produceOpts.codecOptions = VIDEO_CODEC_OPTIONS;
        }

        const newProducer = await sendTransportRef.current.produce(produceOpts);
        producersRef.current[mediaType] = newProducer;

        setMyStream(prevStream => {
          const newStream = prevStream
            ? new MediaStream(prevStream.getTracks())
            : new MediaStream();
          newStream.addTrack(track);
          myStreamRef.current = newStream;
          return newStream;
        });
        if (mediaType === 'video') setIsVideoEnabled(true);
        if (mediaType === 'audio') setIsAudioEnabled(true);
      } catch (error) {
        console.error(`Failed to get ${mediaType} device.`, error);
        toast.error(`Could not start ${mediaType}. Check permissions.`);
      }
    } else {
      socket.emit('close-producer', { producerId: producer.id });
      producer.close();
      producersRef.current[mediaType] = null;

      setMyStream(prevStream => {
        if (!prevStream) {
          myStreamRef.current = null;
          return null;
        }
        const trackToRemove = prevStream.getTracks().find(t => t.kind === mediaType);
        if (trackToRemove) {
          trackToRemove.stop();
          prevStream.removeTrack(trackToRemove);
        }
        if (prevStream.getTracks().length === 0) {
          myStreamRef.current = null;
          return null;
        }
        const next = new MediaStream(prevStream.getTracks());
        myStreamRef.current = next;
        return next;
      });
      if (mediaType === 'video') setIsVideoEnabled(false);
      if (mediaType === 'audio') setIsAudioEnabled(false);
    }
  }, [socket]);

  const setConsumerPaused = useCallback((peerSocketId, kindOrType, paused) => {
    if (!socket) return;
    for (const [, info] of consumersRef.current.entries()) {
      if (info.socketId !== peerSocketId) continue;
      const matches =
        kindOrType === 'screen'
          ? info.type === 'screen'
          : info.kind === kindOrType && info.type !== 'screen';
      if (!matches) continue;
      try { paused ? info.consumer.pause() : info.consumer.resume(); } catch { /* ignore */ }
      socket.emit(paused ? 'pause-consumer' : 'resume-consumer', { consumerId: info.consumer.id });
    }
  }, [socket]);

  const sendChatMessage = useCallback((text) => {
    if (!socket || !text?.trim()) return;
    socket.emit('chat-message', { text: text.trim() });
  }, [socket]);

  const toggleRaiseHand = useCallback(() => {
    if (!socket) return;
    setHandRaised(prev => {
      const next = !prev;
      socket.emit('raise-hand', { raised: next });
      return next;
    });
  }, [socket]);

  const sendReaction = useCallback((emoji) => {
    if (!socket || !emoji) return;
    socket.emit('reaction', { emoji });
  }, [socket]);

  const getConsumerStats = useCallback(async (peerSocketId, kindOrType = 'video') => {
    for (const [, info] of consumersRef.current.entries()) {
      if (info.socketId !== peerSocketId) continue;
      const isMatch =
        kindOrType === 'screen'
          ? info.type === 'screen'
          : info.kind === kindOrType && info.type !== 'screen';
      if (!isMatch) continue;
      try { return await info.consumer.getStats(); } catch { return null; }
    }
    return null;
  }, []);

  const togglePin = useCallback((socketId) => {
    setPinnedPeerId(prev => (prev === socketId ? null : socketId));
  }, []);

  return {
    myStream,
    screenStream,
    remoteStreams,
    users,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    toggleMedia,
    toggleScreenShare,

    activeSpeakerId,
    raisedHands,
    handRaised,
    messages,
    reactions,
    pinnedPeerId,
    sendChatMessage,
    toggleRaiseHand,
    sendReaction,
    togglePin,

    setConsumerPaused,
    getConsumerStats,
  };
};
