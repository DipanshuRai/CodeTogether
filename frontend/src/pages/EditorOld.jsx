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

  // Media State
  // --- FIX 1: Simplify Media State ---
  // myStream will hold the complete, ready-to-use MediaStream object.
  const myStreamRef = useRef(new MediaStream());
  const [myStream, setMyStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  
  // WebRTC State
  const peerConnections = useRef({}); // { socketId: RTCPeerConnection }
  const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: MediaStream }
  const [users, setUsers] = useState([]); // { id: string, name: string }[]
  const [isUsersPanelVisible, setIsUsersPanelVisible] = useState(true);

  // Helper to update all peer connections with a new track
  const replaceTrackInPeers = useCallback(async (track, kind) => {
    for (const pc of Object.values(peerConnections.current)) {
      const sender = pc.getSenders().find((s) => s.track?.kind === kind);
      if (sender) {
        await sender.replaceTrack(track);
      }
    }
  }, []);

  const updateMedia = useCallback(async (requestedVideo, requestedAudio) => {
      // VIDEO
      if (requestedVideo && !isVideoEnabled) {
          try {
              const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
              const videoTrack = videoStream.getVideoTracks()[0];
              myStreamRef.current.addTrack(videoTrack);
              await replaceTrackInPeers(videoTrack, 'video');
              setIsVideoEnabled(true);
          } catch (err) {
              console.error("Failed to get video stream:", err);
              toast.error("Could not access camera. Please grant permission.");
              setIsVideoEnabled(false); // Revert state on failure
          }
      } else if (!requestedVideo && isVideoEnabled) {
          myStreamRef.current.getVideoTracks().forEach(track => {
              track.stop();
              myStreamRef.current.removeTrack(track);
          });
          await replaceTrackInPeers(null, 'video');
          setIsVideoEnabled(false);
      }

      // AUDIO
      if (requestedAudio && !isAudioEnabled) {
          try {
              const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const audioTrack = audioStream.getAudioTracks()[0];
              myStreamRef.current.addTrack(audioTrack);
              await replaceTrackInPeers(audioTrack, 'audio');
              setIsAudioEnabled(true);
          } catch (err) {
              console.error("Failed to get audio stream:", err);
              toast.error("Could not access microphone. Please grant permission.");
              setIsAudioEnabled(false); // Revert state on failure
          }
      } else if (!requestedAudio && isAudioEnabled) {
          myStreamRef.current.getAudioTracks().forEach(track => {
              track.stop();
              myStreamRef.current.removeTrack(track);
          });
          await replaceTrackInPeers(null, 'audio');
          setIsAudioEnabled(false);
      }
      
      setMyStream(new MediaStream(myStreamRef.current.getTracks()));
  }, [isVideoEnabled, isAudioEnabled, replaceTrackInPeers]);


  const toggleAudio = () => updateMedia(isVideoEnabled, !isAudioEnabled);
  const toggleVideo = () => updateMedia(!isVideoEnabled, isAudioEnabled);

  const createPeerConnection = useCallback((peerSocketId) => {
      const pc = new RTCPeerConnection(PEER_CONNECTION_CONFIG);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc:ice-candidate", { to: peerSocketId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStreams((prev) => ({ ...prev, [peerSocketId]: event.streams[0] }));
      };

      myStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, myStreamRef.current);
      });

      peerConnections.current[peerSocketId] = pc;
      return pc;
    },[socket]
  );

  // --- FIX 1: Create a reusable function to initiate a connection ---
  // This abstracts the logic for creating and sending a WebRTC offer.
  const initiatePeerConnectionAndOffer = useCallback(async (peerSocketId) => {
    // Avoid creating duplicate connections
    if (peerConnections.current[peerSocketId]) {
      console.warn(`Connection to ${peerSocketId} already exists or is in progress.`);
      return;
    }
    console.log(`Initiating WebRTC connection to new peer: ${peerSocketId}`);
    const pc = createPeerConnection(peerSocketId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc:offer", { to: peerSocketId, offer });
  }, [createPeerConnection, socket]);
  
  // Initialize media on mount
  useEffect(() => {
    if (roomId === "solo") return;
    updateMedia(true, true); 

    return () => {
      myStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]); 

  // Main socket and WebRTC event handling effect
  useEffect(() => {
    if (!socket || roomId === "solo") return;

    const handleNewUser = async ({ socketId, name }) => {
      if (peerConnections.current[socketId]) return;
      toast(`${name} joined the room.`);
      initiatePeerConnectionAndOffer(socketId);
    };

    // --- FIX 1: REMOVED `users` DEPENDENCY ---
    // The console.log is simplified to avoid the dependency.
    const handleOffer = async ({ from, offer }) => {
      console.log(`Received offer from ${from}. Creating answer...`);
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { to: from, answer });
    };

    const handleAnswer = async ({ from, answer }) => {
      const pc = peerConnections.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      const pc = peerConnections.current[from];
      if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
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

    // Set up listeners
    socket.on("user-joined", handleNewUser);
    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);
    socket.on("user-left", handleUserLeft);
    socket.on("update-user-list", handleUserListUpdate);
    socket.on("remote-code-change", handleRemoteCodeChange);
    socket.on("new-admin", handleNewAdmin);
    
    // Initial check to ensure user belongs in the room
    socket.emit("check-user", roomId, (response) => {
      if (response.success && response.users) {
        // Successfully verified. Now populate the user list from the response.
        handleUserListUpdate(response.users);

        // --- FIX 3: Proactively connect to all existing users ---
        // Get the list of users *other than myself*
        const otherUsers = response.users.filter(u => u.id !== socket.id);
        console.log('Initiating connections to existing users:', otherUsers);
        
        // Loop through them and initiate a connection to each one
        otherUsers.forEach(user => {
            initiatePeerConnectionAndOffer(user.id);
        });
      } else if (!response.success) {
        toast.error(response.message || "Access denied. Please rejoin.");
        navigate("/");
      }
    });

    return () => {
      socket.off("user-joined", handleNewUser);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
      socket.off("user-left", handleUserLeft);
      socket.off("update-user-list", handleUserListUpdate);
      socket.off("remote-code-change", handleRemoteCodeChange);
      socket.off("new-admin", handleNewAdmin);

      // Clean up connections and leave room
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      if (roomId !== "solo") {
        socket.emit("leave-room");
      }
    };
    // --- FIX 2: SIMPLIFIED DEPENDENCY ARRAY ---
    // The handlers are now stable and don't need to be in the array.
  }, [socket, roomId, navigate, createPeerConnection, initiatePeerConnectionAndOffer]);

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

  // (The rest of the component's return statement is unchanged)
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