import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  createDevice,
  loadDevice,
  createSendTransport,
  createRecvTransport,
  consumeStream,
} from '../utils/mediasoup-client';

const SCREEN_SHARE_ENCODINGS = [
  { rid: 'r0', maxBitrate: 100000, scalabilityMode: 'S1T3' },
  { rid: 'r1', maxBitrate: 300000, scalabilityMode: 'S1T3' },
  { rid: 'r2', maxBitrate: 900000, scalabilityMode: 'S1T3' },
];

export const useMediasoup = (socket, roomId) => {
  // Local Media State
  const [myStream, setMyStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);

  // Remote Media State
  const [remoteStreams, setRemoteStreams] = useState({});
  const [users, setUsers] = useState([]);

  // Mediasoup-specific refs
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef({ video: null, audio: null, screen: null });
  const consumersRef = useRef(new Map());
  const screenStreamRef = useRef(null);

  const handleConsumeStream = useCallback(async (producerId, socketId, kind, type) => {
    if (!deviceRef.current || !recvTransportRef.current?.id) return;
    
    try {
      const { consumer, stream } = await consumeStream(socket, deviceRef.current, recvTransportRef.current, producerId, deviceRef.current.rtpCapabilities);
      consumersRef.current.set(consumer.id, consumer);

      consumer.on("producerclose", () => {
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
    if (roomId === "solo" || !socket) return;

    let isMounted = true;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!isMounted) return stream.getTracks().forEach(t => t.stop());
        setMyStream(stream);

        const device = createDevice();
        deviceRef.current = device;

        const routerRtpCapabilities = await new Promise(resolve => socket.emit("get-router-rtp-capabilities", roomId, resolve));
        await loadDevice(routerRtpCapabilities, device);

        sendTransportRef.current = await createSendTransport(socket, device, roomId);
        recvTransportRef.current = await createRecvTransport(socket, device, roomId);

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (videoTrack) producersRef.current.video = await sendTransportRef.current.produce({ track: videoTrack, appData: { type: 'video' } });
        if (audioTrack) producersRef.current.audio = await sendTransportRef.current.produce({ track: audioTrack, appData: { type: 'audio' } });
        
        socket.emit("get-initial-producers", roomId, producers => {
          if (!isMounted) return;
          for (const { producerId, socketId, kind, type } of producers) {
            handleConsumeStream(producerId, socketId, kind, type);
          }
        });
      } catch (err) {
        console.error("Initialization failed:", err);
        toast.error("Camera/Mic access denied or media connection failed.");
      }
    };

    init();

    const handleNewProducer = ({ producerId, socketId, kind, type }) => handleConsumeStream(producerId, socketId, kind, type);
    const handleProducerClosed = ({ socketId }) => setRemoteStreams(prev => { const ns = { ...prev }; delete ns[socketId]; return ns; });
    const handleSpecificProducerClosed = ({ producerId }) => {
      for (const consumer of consumersRef.current.values()) {
        if (consumer.producerId === producerId) {
          consumer.close();
          break;
        }
      }
    };
    const handleUserListUpdate = userList => setUsers(userList.filter(u => u.id !== socket.id));
    const handleNewUser = ({ name }) => toast(`${name} joined the room.`);
    const handleUserLeft = ({ name }) => toast(`${name} left the room.`);
    
    socket.on("new-producer", handleNewProducer);
    socket.on("producer-closed", handleProducerClosed);
    socket.on("specific-producer-closed", handleSpecificProducerClosed);
    socket.on("update-user-list", handleUserListUpdate);
    socket.on("user-joined", handleNewUser);
    socket.on("user-left", handleUserLeft);
    
    return () => {
      isMounted = false;
      myStream?.getTracks().forEach(track => track.stop());
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      socket.off("new-producer", handleNewProducer);
      socket.off("producer-closed", handleProducerClosed);
      socket.off("specific-producer-closed", handleSpecificProducerClosed);
      socket.off("update-user-list", handleUserListUpdate);
      socket.off("user-joined", handleNewUser);
      socket.off("user-left", handleUserLeft);
      if (roomId !== "solo") socket.emit("leave-room");
    };
  }, [socket, roomId, handleConsumeStream]);

  const toggleScreenShare = useCallback(async () => {
    if (!sendTransportRef.current) return toast.error("Media server not connected.");

    if (isScreenSharing) {
      producersRef.current.screen?.close();
      producersRef.current.screen = null;
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsScreenSharing(false);
      toast.success("Screen sharing stopped");
    } else {
      try {
        const captureStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = captureStream.getVideoTracks()[0];
        if (!screenTrack) throw new Error("No video track found");

        screenTrack.addEventListener('ended', () => {
          producersRef.current.screen?.close();
          producersRef.current.screen = null;
          setScreenStream(null);
          setIsScreenSharing(false);
          toast("Screen sharing ended");
        });

        screenStreamRef.current = captureStream;
        setScreenStream(captureStream);
        const screenProducer = await sendTransportRef.current.produce({ track: screenTrack, encodings: SCREEN_SHARE_ENCODINGS, appData: { type: 'screen' } });
        producersRef.current.screen = screenProducer;
        setIsScreenSharing(true);
        toast.success("Screen sharing started");
      } catch (error) {
        if (error.name !== 'NotAllowedError') toast.error("Could not start screen sharing");
        setIsScreenSharing(false);
        setScreenStream(null);
      }
    }
  }, [isScreenSharing]);

  const toggleMedia = useCallback(async (mediaType) => {
    const producer = producersRef.current[mediaType];
    if (!producer) return;

    if (producer.paused) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ [mediaType]: true });
        const newTrack = stream.getTracks()[0];
        await producer.replaceTrack({ track: newTrack });
        await producer.resume();
        if (myStream) {
          const oldTrack = myStream.getTracks().find(t => t.kind === mediaType);
          if (oldTrack) myStream.removeTrack(oldTrack);
          myStream.addTrack(newTrack);
          setMyStream(new MediaStream(myStream.getTracks()));
        }
        if (mediaType === 'video') setIsVideoEnabled(true);
        if (mediaType === 'audio') setIsAudioEnabled(true);
      } catch (error) {
        toast.error(`Could not start ${mediaType}. Check permissions.`);
      }
    } else {
      producer.track?.stop();
      await producer.pause();
      if (mediaType === 'video') setIsVideoEnabled(false);
      if (mediaType === 'audio') setIsAudioEnabled(false);
    }
  }, [myStream]);

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
  };
};