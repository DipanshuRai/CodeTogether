import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import { CODE_SNIPPETS } from "../utils/constants";
import { useAuth } from "../context/AuthProvider";
import { useSocket } from "../context/socket";
import { Allotment } from "allotment";
import EditorHeader from "../components/EditorHeader";
import Input from "../components/Input";
import Output from "../components/Output";
import VideoPlayer from "../components/VideoPlayer";
import Whiteboard from "../components/Whiteboard";
import "allotment/dist/style.css";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import "./styles/CodeEditor.css";
import {
  createDevice,
  loadDevice,
  createSendTransport,
  createRecvTransport,
  consumeStream,
} from "../utils/mediasoup-client";

const SCREEN_SHARE_ENCODINGS = [
  { rid: 'r0', maxBitrate: 100000, scalabilityMode: 'S1T3' },
  { rid: 'r1', maxBitrate: 300000, scalabilityMode: 'S1T3' },
  { rid: 'r2', maxBitrate: 900000, scalabilityMode: 'S1T3' },
];

const CodeEditor = () => {
  const { auth } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const { roomId } = useParams();

  // Editor and UI State
  const editorRef = useRef();
  const [language, setLanguage] = useState("cpp");
  const [value, setValue] = useState(CODE_SNIPPETS[language]);
  const [output, setOutput] = useState(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [activeView, setActiveView] = useState("io");
  const [users, setUsers] = useState([]);
  const [isUsersPanelVisible, setIsUsersPanelVisible] = useState(true);

  // Local Media State
  const [myStream, setMyStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [fullscreenStream, setFullscreenStream] = useState(null);
  
  // Mediasoup-specific refs
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef({ video: null, audio: null, screen: null });
  const consumersRef = useRef(new Map());

  // Ref to hold screen stream to manage its lifecycle
  const screenStreamRef = useRef(null);

  // --- Signaling and Media Consumption ---
  const handleConsumeStream = useCallback(async (producerId, socketId, kind, type) => {
    if (!deviceRef.current || !recvTransportRef.current?.id) return;
    
    try {
      console.log(`Consuming stream: ${type} from ${socketId}`);
      const { consumer, stream } = await consumeStream(
        socket, 
        deviceRef.current, 
        recvTransportRef.current, 
        producerId, 
        deviceRef.current.rtpCapabilities
      );
      
      consumersRef.current.set(consumer.id, consumer);

      // This event is key for cleanup. It fires when the producer is closed.
      consumer.on("producerclose", () => {
        console.log(`Producer closed for consumer ${consumer.id} (${type} from ${socketId})`);
        consumersRef.current.delete(consumer.id);
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          if (newStreams[socketId]) {
            const streamType = type === 'screen' ? 'screen' : kind;
            delete newStreams[socketId][streamType];
            if (Object.keys(newStreams[socketId]).length === 0) {
              delete newStreams[socketId];
            }
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

  // --- Main Initialization and Cleanup Effect ---
  useEffect(() => {
    if (roomId === "solo" || !socket) return;

    let isMounted = true;

    const init = async () => {
      try {
        console.log("Initializing media and WebRTC...");
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        if (!isMounted) return stream.getTracks().forEach(t => t.stop());
        setMyStream(stream);

        const device = createDevice();
        deviceRef.current = device;

        const routerRtpCapabilities = await new Promise((resolve) => {
          socket.emit("get-router-rtp-capabilities", roomId, resolve);
        });
        await loadDevice(routerRtpCapabilities, device);

        sendTransportRef.current = await createSendTransport(socket, device, roomId);
        recvTransportRef.current = await createRecvTransport(socket, device, roomId);

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (videoTrack) {
          producersRef.current.video = await sendTransportRef.current.produce({ 
            track: videoTrack, 
            appData: { type: 'video' } 
          });
        }
        if (audioTrack) {
          producersRef.current.audio = await sendTransportRef.current.produce({ 
            track: audioTrack, 
            appData: { type: 'audio' } 
          });
        }
        
        socket.emit("get-initial-producers", roomId, (producers) => {
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

    const handleNewProducer = ({ producerId, socketId, kind, type }) => {
      handleConsumeStream(producerId, socketId, kind, type);
    };

    const handleProducerClosed = ({ socketId }) => {
      // This is for when a user leaves entirely.
      console.log(`All producers closed for socket ${socketId}`);
      setRemoteStreams(prev => { 
        const ns = { ...prev }; 
        delete ns[socketId]; 
        return ns; 
      });
    };

    const handleSpecificProducerClosed = ({ producerId }) => {
        // This is handled by the consumer's 'producerclose' event.
        // The server sends this event to ensure timely cleanup if the 'producerclose' event is missed.
        console.log(`Received specific producer closed event for ${producerId}`);
        for (const consumer of consumersRef.current.values()) {
            if (consumer.producerId === producerId) {
                consumer.close(); // Closing the consumer will trigger its 'producerclose' handler for cleanup.
                break;
            }
        }
    };

    const handleUserListUpdate = (userList) => setUsers(userList.filter(u => u.id !== socket.id));
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
      console.log("Running cleanup: Closing all media connections.");
      
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
      
      if (roomId !== "solo") {
        socket.emit("leave-room");
      }
    };
  }, [socket, roomId, handleConsumeStream]);

  // --- Screen Sharing Toggle ---
  const handleToggleScreenShare = useCallback(async () => {
    if (!sendTransportRef.current) return toast.error("Media server not connected.");

    if (isScreenSharing) {
      console.log("Stopping screen share...");
      if (producersRef.current.screen && !producersRef.current.screen.closed) {
        producersRef.current.screen.close(); // This will trigger the 'close' event on the server
      }
      producersRef.current.screen = null;
      
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      
      setScreenStream(null);
      setIsScreenSharing(false);
      toast.success("Screen sharing stopped");
      
    } else {
      console.log("Starting screen share...");
      try {
        const captureStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = captureStream.getVideoTracks()[0];
        if (!screenTrack) throw new Error("No video track found");

        screenTrack.addEventListener('ended', () => {
          // This handles when the user clicks the browser's "Stop sharing" button
          if (producersRef.current.screen && !producersRef.current.screen.closed) {
            producersRef.current.screen.close();
          }
          producersRef.current.screen = null;
          setScreenStream(null);
          setIsScreenSharing(false);
          toast("Screen sharing ended");
        });

        screenStreamRef.current = captureStream;
        setScreenStream(captureStream);

        const screenProducer = await sendTransportRef.current.produce({
          track: screenTrack,
          encodings: SCREEN_SHARE_ENCODINGS,
          appData: { type: 'screen' }
        });

        producersRef.current.screen = screenProducer;
        setIsScreenSharing(true);
        toast.success("Screen sharing started");
        
      } catch (error) {
        console.error("Screen share error:", error);
        if (error.name !== 'NotAllowedError') {
          toast.error("Could not start screen sharing");
        }
        setIsScreenSharing(false);
        setScreenStream(null);
      }
    }
  }, [isScreenSharing]);

  // --- Improved Media Toggle ---
  const toggleMedia = useCallback(async (mediaType) => {
    const producer = producersRef.current[mediaType];
    if (!producer) {
      console.warn(`${mediaType} producer not found.`);
      return;
    }

    // --- Turn media ON ---
    if (producer.paused) {
      try {
        // Request a new track from hardware
        const stream = await navigator.mediaDevices.getUserMedia({ [mediaType]: true });
        const newTrack = stream.getTracks()[0];

        // Replace the track on the producer
        await producer.replaceTrack({ track: newTrack });
        // Resume the producer to start sending data from the new track
        await producer.resume();

        // Update the local MediaStream state for the VideoPlayer component
        if (myStream) {
            const oldTrack = myStream.getTracks().find(t => t.kind === mediaType);
            if (oldTrack) {
                myStream.removeTrack(oldTrack);
                oldTrack.stop(); // Ensure old track is stopped
            }
            myStream.addTrack(newTrack);
            setMyStream(new MediaStream(myStream.getTracks())); // Trigger re-render
        }

        // Update UI state
        if (mediaType === 'video') setIsVideoEnabled(true);
        if (mediaType === 'audio') setIsAudioEnabled(true);
        console.log(`${mediaType} has been turned on.`);

      } catch (error) {
        console.error(`Failed to turn on ${mediaType}:`, error);
        toast.error(`Could not start ${mediaType}. Please check permissions.`);
      }
    } 
    // --- Turn media OFF ---
    else {
      try {
        const track = producer.track;
        if (track) {
          // Stop the hardware track. This turns off the camera light.
          track.stop();
        }
        
        // Pausing the producer informs consumers that the stream is muted.
        await producer.pause();

        // Update UI state
        if (mediaType === 'video') setIsVideoEnabled(false);
        if (mediaType === 'audio') setIsAudioEnabled(false);
        console.log(`${mediaType} has been turned off.`);

      } catch (error) {
        console.error(`Failed to turn off ${mediaType}:`, error);
      }
    }
  }, [myStream]);

  const toggleFullscreen = (stream, name, type) => {
    setFullscreenStream(prev => (prev?.stream === stream ? null : { stream, name, type }));
  };

  const [remoteStreams, setRemoteStreams] = useState({});
  
  // --- Rendering Logic ---
  const MainContent = () => {
    const remoteUserElements = users.map(user => {
      const userStreams = remoteStreams[user.id] || {};
      const userName = user.name;

      // Only render if there is at least one active stream
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
  
  return (
    <div className="code-editor-layout">
      <EditorHeader
        language={language}
        onSelect={(lang) => { setLanguage(lang); setValue(CODE_SNIPPETS[lang]); }}
        editorRef={editorRef}
        setIsError={setIsError}
        setOutput={setOutput}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        onToggleUsers={() => setIsUsersPanelVisible(p => !p)}
        input={input}
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        toggleAudio={() => toggleMedia('audio')}
        toggleVideo={() => toggleMedia('video')}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={handleToggleScreenShare}
        activeView={activeView}
        onViewChange={setActiveView}
      />
      <main className="main-content">
        <Allotment>
          <Allotment.Pane preferredSize={850} minSize={300}>
            <Editor
              height="100%"
              theme="vs-dark"
              language={language}
              defaultValue={CODE_SNIPPETS[language]}
              value={value}
              onMount={(editor) => { editorRef.current = editor; editor.focus(); }}
              onChange={(newValue) => setValue(newValue)}
            />
          </Allotment.Pane>
          <Allotment.Pane minSize={300}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeView}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ height: "100%" }}
              >
                {activeView === "io" ? (
                  <Allotment vertical>
                    <Allotment.Pane><Input input={input} setInput={setInput} /></Allotment.Pane>
                    <Allotment.Pane><Output output={output} isLoading={isLoading} isError={isError} /></Allotment.Pane>
                  </Allotment>
                ) : (
                  <Whiteboard />
                )}
              </motion.div>
            </AnimatePresence>
          </Allotment.Pane>
          {isUsersPanelVisible && roomId !== "solo" && (
            <Allotment.Pane preferredSize={250} minSize={200} maxSize={400}>
              <MainContent />
            </Allotment.Pane>
          )}
        </Allotment>
      </main>
    </div>
  );
};

export default CodeEditor;