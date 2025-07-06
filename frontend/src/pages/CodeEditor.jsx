// CodeEditor.jsx

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import { CODE_SNIPPETS } from "../constants";
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
import "./CodeEditor.css";

// WebRTC STUN servers
const PEER_CONNECTION_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
};

const CodeEditor = () => {
  const { auth } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const { roomId } = useParams();

  // Editor State
  const editorRef = useRef();
  const [language, setLanguage] = useState("cpp");
  const [value, setValue] = useState(CODE_SNIPPETS[language]);
  const [output, setOutput] = useState(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [activeView, setActiveView] = useState("io"); // "io" or "whiteboard"

  // Media State
  const [myStream, setMyStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  // WebRTC State
  const peerConnections = useRef({}); // { socketId: RTCPeerConnection }
  const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: MediaStream }
  const [users, setUsers] = useState([]); // { id: string, name: string }[]
  const [isUsersPanelVisible, setIsUsersPanelVisible] = useState(true);

  const createPeerConnection = useCallback(
    (peerSocketId, stream) => {
      if (!stream) {
        console.error("Cannot create peer connection without a local stream.");
        return null;
      }
      const pc = new RTCPeerConnection(PEER_CONNECTION_CONFIG);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc:ice-candidate", {
            to: peerSocketId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        console.log(`Received track from ${peerSocketId}`, event.track);
        setRemoteStreams((prev) => ({
          ...prev,
          [peerSocketId]: event.streams[0],
        }));
      };

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      peerConnections.current[peerSocketId] = pc;
      return pc;
    },
    [socket]
  );

  const initiatePeerConnectionAndOffer = useCallback(
    async (peerSocketId, stream) => {
      if (peerConnections.current[peerSocketId]) {
        console.warn(`Connection to ${peerSocketId} already exists.`);
        return;
      }
      console.log(`Initiating WebRTC connection to new peer: ${peerSocketId}`);

      const pc = createPeerConnection(peerSocketId, stream);
      if (!pc) return;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc:offer", { to: peerSocketId, offer });
    },
    [createPeerConnection, socket]
  );

  useEffect(() => {
    if (roomId === "solo") return;

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setMyStream(stream);
      } catch (err) {
        console.error("Failed to get media stream:", err);
        toast.error("Camera/Mic access denied. Video chat disabled.");
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
        setMyStream(new MediaStream());
      }
    };
    initMedia();
  }, [roomId]);

  useEffect(() => {
    if (!socket || !myStream || roomId === "solo") return;

    // --- (event handlers like handleNewUser, handleOffer, etc. are unchanged) ---
    const handleNewUser = ({ name }) => toast(`${name} joined the room.`);

    const handleOffer = async ({ from, offer }) => {
      console.log(`Received offer from ${from}. Creating answer...`);
      const pc = createPeerConnection(from, myStream);
      if (!pc) return;

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { to: from, answer });
    };

    const handleAnswer = async ({ from, answer }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`Connection established with ${from}`);
      }
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      const pc = peerConnections.current[from];
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const handleUserLeft = ({ socketId, name }) => {
      toast(`${name} left the room.`);
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
      setRemoteStreams((prev) => {
        const newStreams = { ...prev };
        delete newStreams[socketId];
        return newStreams;
      });
    };

    const handleUserListUpdate = (userList) => {
      setUsers(userList.filter((u) => u.id !== socket.id));
    };

    const handleRemoteCodeChange = ({ code, language }) => {
      setLanguage(language);
      setValue(code);
    };

    const handleNewAdmin = () => toast("You are the new admin!");

    // Setup all socket listeners
    socket.on("user-joined", handleNewUser);
    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);
    socket.on("user-left", handleUserLeft);
    socket.on("update-user-list", handleUserListUpdate);
    socket.on("remote-code-change", handleRemoteCodeChange);
    socket.on("new-admin", handleNewAdmin);

    socket.emit("check-user", roomId, (response) => {
      if (response.success && response.users) {
        handleUserListUpdate(response.users);
        const otherUsers = response.users.filter((u) => u.id !== socket.id);
        console.log(
          "Media is ready. Initiating connections to existing users:",
          otherUsers
        );
        otherUsers.forEach((user) => {
          initiatePeerConnectionAndOffer(user.id, myStream);
        });
      } else if (!response.success) {
        toast.error(response.message || "Access denied. Please rejoin.");
        navigate("/");
      }
    });

    return () => {
      myStream?.getTracks().forEach((track) => track.stop());

      socket.off("user-joined", handleNewUser);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
      socket.off("user-left", handleUserLeft);
      socket.off("update-user-list", handleUserListUpdate);
      socket.off("remote-code-change", handleRemoteCodeChange);
      socket.off("new-admin", handleNewAdmin);

      Object.values(peerConnections.current).forEach((pc) => pc.close());
      peerConnections.current = {};
      if (roomId !== "solo") {
        socket.emit("leave-room");
      }
    };
  }, [
    socket,
    myStream,
    roomId,
    navigate,
    createPeerConnection,
    initiatePeerConnectionAndOffer,
  ]);

  // --- FIX [HARDWARE]: New function to toggle tracks, stop hardware, and notify peers ---
  const toggleMediaTrack = useCallback(
    async (mediaType, isEnabled, setIsEnabled) => {
      if (!myStream) return;

      if (isEnabled) {
        // --- Turn OFF the media track ---
        const trackToStop = myStream
          .getTracks()
          .find((track) => track.kind === mediaType);
        if (trackToStop) {
          trackToStop.stop(); // This turns off the camera/mic light
          myStream.removeTrack(trackToStop); // Remove from the stream object

          // Inform peers that the track is removed by replacing it with null
          for (const pc of Object.values(peerConnections.current)) {
            const sender = pc
              .getSenders()
              .find((s) => s.track?.kind === mediaType);
            if (sender) {
              sender.replaceTrack(null);
            }
          }
        }
        setIsEnabled(false);
      } else {
        // --- Turn ON the media track ---
        try {
          // Request a new stream with only the desired media type
          const newMediaStream = await navigator.mediaDevices.getUserMedia({
            [mediaType]: true,
            audio: mediaType === "audio",
            video: mediaType === "video",
          });
          const newTrack = newMediaStream.getTracks()[0];

          // Add the new track to our main local stream
          myStream.addTrack(newTrack);

          // Inform peers of the new track
          for (const pc of Object.values(peerConnections.current)) {
            // Find the sender for this media type (it might have a null track)
            const sender = pc
              .getSenders()
              .find((s) => s.track === null || s.track.kind === mediaType);
            if (sender) {
              sender.replaceTrack(newTrack);
            }
          }
          setIsEnabled(true);
        } catch (error) {
          console.error(`Failed to get new ${mediaType} track:`, error);
          toast.error(
            `Could not enable ${mediaType}. Check browser permissions.`
          );
          setIsEnabled(false); // Ensure state remains 'off' if it fails
        }
      }
    },
    [myStream]
  );

  const toggleAudio = () =>
    toggleMediaTrack("audio", isAudioEnabled, setIsAudioEnabled);
  const toggleVideo = () =>
    toggleMediaTrack("video", isVideoEnabled, setIsVideoEnabled);

  // --- (Rest of the component is unchanged) ---
  const onSelect = (language) => {
    const snippet = CODE_SNIPPETS[language];
    setLanguage(language);
    setValue(snippet);
    if (socket && roomId !== "solo")
      socket.emit("code-change", { language, code: snippet });
  };

  const handleCodeChange = (newValue) => {
    setValue(newValue);
    if (socket && roomId !== "solo")
      socket.emit("code-change", { language, code: newValue });
  };

  const onMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  return (
    <div className="code-editor-layout">
      <EditorHeader
        language={language}
        onSelect={onSelect}
        editorRef={editorRef}
        setIsError={setIsError}
        setOutput={setOutput}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        onToggleUsers={() => setIsUsersPanelVisible((prev) => !prev)}
        input={input}
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
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
              onMount={onMount}
              onChange={handleCodeChange}
              options={{ padding: { top: 10 }, formatOnPaste: true }}
            />
          </Allotment.Pane>
          <Allotment.Pane minSize={300}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeView}
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ height: "100%" }}
              >
                {activeView === "io" ? (
                  <Allotment vertical>
                    <Allotment.Pane minSize={200}>
                      <Input input={input} setInput={setInput} />
                    </Allotment.Pane>
                    <Allotment.Pane minSize={200}>
                      <Output
                        output={output}
                        isLoading={isLoading}
                        isError={isError}
                      />
                    </Allotment.Pane>
                  </Allotment>
                ) : (
                  <Whiteboard roomId={roomId} />
                )}
              </motion.div>
            </AnimatePresence>
          </Allotment.Pane>
          {isUsersPanelVisible && roomId !== "solo" && (
            <Allotment.Pane preferredSize={250} minSize={200} maxSize={400}>
              <div className="users-panel">
                <div className="my-video-container">
                  <VideoPlayer
                    stream={myStream}
                    name={`${auth?.user?.fullname} (You)`}
                    isMuted={true}
                    isVideoEnabled={isVideoEnabled}
                  />
                </div>
                <div className="remote-videos-grid">
                  {users.map((user) => (
                    <div key={user.id}>
                      <VideoPlayer
                        stream={remoteStreams[user.id]}
                        name={user.name}
                        isMuted={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Allotment.Pane>
          )}
        </Allotment>
      </main>
    </div>
  );
};

export default CodeEditor;
