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
import "allotment/dist/style.css";
import toast from "react-hot-toast";
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

  // --- FIX 1: Simplify Media State ---
  // myStream will hold the complete, ready-to-use MediaStream object.
  const [myStream, setMyStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  // WebRTC State
  const peerConnections = useRef({}); // { socketId: RTCPeerConnection }
  const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: MediaStream }
  const [users, setUsers] = useState([]); // { id: string, name: string }[]
  const [isUsersPanelVisible, setIsUsersPanelVisible] = useState(true);


  // --- FIX 2: Create a stable `createPeerConnection` that takes the stream as an argument ---
  // This makes the dependency explicit and the function more predictable.
  const createPeerConnection = useCallback((peerSocketId, stream) => {
      if (!stream) {
        console.error("Cannot create peer connection without a local stream.");
        return null;
      }
      const pc = new RTCPeerConnection(PEER_CONNECTION_CONFIG);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc:ice-candidate", { to: peerSocketId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        console.log(`Received track from ${peerSocketId}`, event.track);
        setRemoteStreams((prev) => ({ ...prev, [peerSocketId]: event.streams[0] }));
      };

      // Add tracks from the local stream to the connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      peerConnections.current[peerSocketId] = pc;
      return pc;
    }, [socket]
  );

  const initiatePeerConnectionAndOffer = useCallback(async (peerSocketId, stream) => {
    if (peerConnections.current[peerSocketId]) {
      console.warn(`Connection to ${peerSocketId} already exists.`);
      return;
    }
    console.log(`Initiating WebRTC connection to new peer: ${peerSocketId}`);
    
    // Pass the stream to the creation function
    const pc = createPeerConnection(peerSocketId, stream);
    if (!pc) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc:offer", { to: peerSocketId, offer });
  }, [createPeerConnection, socket]);

  // --- FIX 3: Dedicated `useEffect` for Media Acquisition ---
  // This hook runs ONCE on mount to get the media. It's the first step.
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
        // Still allow joining the room without media
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
        setMyStream(new MediaStream()); // Create an empty stream to allow logic to proceed
      }
    };
    initMedia();
    
    return () => {
      // Cleanup stream when component unmounts
      myStream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);


  // --- FIX 4: Main `useEffect` now DEPENDS on `myStream` ---
  // This entire block of code will NOT run until `myStream` state is set, solving the race condition.
  useEffect(() => {
    // Wait until both the socket and the media stream are ready
    if (!socket || !myStream || roomId === "solo") return;

    // This handler is for EXISTING users. It just shows a toast.
    // The new user is responsible for initiating the connection.
    const handleNewUser = ({ name }) => {
      toast(`${name} joined the room.`);
    };
    
    // This handler is for EXISTING users who receive an offer from a NEW user.
    const handleOffer = async ({ from, offer }) => {
      console.log(`Received offer from ${from}. Creating answer...`);
      const pc = createPeerConnection(from, myStream); // Pass the local stream
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
    
    // Now that listeners are set up AND we have a media stream, check in with the server.
    socket.emit("check-user", roomId, (response) => {
      if (response.success && response.users) {
        handleUserListUpdate(response.users);
        const otherUsers = response.users.filter(u => u.id !== socket.id);
        console.log('Media is ready. Initiating connections to existing users:', otherUsers);
        // NEW user initiates connections to every EXISTING user
        otherUsers.forEach(user => {
            initiatePeerConnectionAndOffer(user.id, myStream);
        });
      } else if (!response.success) {
        toast.error(response.message || "Access denied. Please rejoin.");
        navigate("/");
      }
    });

    return () => {
      // Clean up all listeners
      socket.off("user-joined", handleNewUser);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
      socket.off("user-left", handleUserLeft);
      socket.off("update-user-list", handleUserListUpdate);
      socket.off("remote-code-change", handleRemoteCodeChange);
      socket.off("new-admin", handleNewAdmin);

      // Clean up all peer connections
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      peerConnections.current = {};
      if (roomId !== "solo") {
        socket.emit("leave-room");
      }
    };
  }, [socket, myStream, roomId, navigate, createPeerConnection, initiatePeerConnectionAndOffer]);

  // --- FIX 5: Simplified Toggle Functions ---
  // This is more efficient than recreating streams.
  const toggleAudio = () => {
    if (myStream) {
      myStream.getAudioTracks().forEach(track => track.enabled = !isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const toggleVideo = () => {
    if (myStream) {
      myStream.getVideoTracks().forEach(track => track.enabled = !isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const onSelect = (language) => {
    const snippet = CODE_SNIPPETS[language];
    setLanguage(language);
    setValue(snippet);
    if (socket && roomId !== "solo") socket.emit("code-change", { language, code: snippet });
  };

  const handleCodeChange = (newValue) => {
    setValue(newValue);
    if (socket && roomId !== "solo") socket.emit("code-change", { language, code: newValue });
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
      />
      <main className="main-content">
        <Allotment>
          <Allotment.Pane preferredSize={850} minSize={300}>
            <Editor /* ...props... */ />
          </Allotment.Pane>
          <Allotment.Pane minSize={300}>
            <Allotment vertical>
              <Allotment.Pane minSize={200}>
                <Input input={input} setInput={setInput} />
              </Allotment.Pane>
              <Allotment.Pane preferredSize={450} minSize={200}>
                <Output output={output} isLoading={isLoading} isError={isError} />
              </Allotment.Pane>
            </Allotment>
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
                        // remote streams don't need the isVideoEnabled prop
                        // as their visibility is controlled by the track itself
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