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

  // WebRTC State
  const peerConnections = useRef({}); // { socketId: RTCPeerConnection }
  const [myStream, setMyStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: MediaStream }
  const [users, setUsers] = useState([]); // { id: string, name: string }[]
  const [isUsersPanelVisible, setIsUsersPanelVisible] = useState(true);

  // Function to create a peer connection for a given peer
  const createPeerConnection = useCallback(
    (peerSocketId) => {
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
        console.log(`Received remote track from ${peerSocketId}`);
        setRemoteStreams((prev) => ({
          ...prev,
          [peerSocketId]: event.streams[0],
        }));
      };

      // Add local tracks to the connection
      if (myStream) {
        myStream.getTracks().forEach((track) => {
          pc.addTrack(track, myStream);
        });
      }

      peerConnections.current[peerSocketId] = pc;
      return pc;
    },
    [socket, myStream]
  );

  // Handle a new user joining: create an offer
  const handleNewUser = useCallback(
    async ({ socketId, name }) => {
      if (peerConnections.current[socketId]) {
        console.log(`Already have a connection with ${name}(${socketId})`);
        return;
      }
      console.log(`New user ${name}(${socketId}) joined. Creating offer...`);
      toast(`${name} joined the room.`);

      const pc = createPeerConnection(socketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("webrtc:offer", { to: socketId, offer });
    },
    [createPeerConnection, socket]
  );

  // Handle receiving an offer: create an answer
  const handleOffer = useCallback(
    async ({ from, offer }) => {
      const peerName = users.find((u) => u.id === from)?.name || "Someone";
      console.log(
        `Received offer from ${peerName}(${from}). Creating answer...`
      );

      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc:answer", { to: from, answer });
    },
    [createPeerConnection, socket, users]
  );

  // Handle receiving an answer
  const handleAnswer = useCallback(async ({ from, answer }) => {
    console.log(`Received answer from ${from}.`);
    const pc = peerConnections.current[from];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }, []);

  // Handle receiving an ICE candidate
  const handleIceCandidate = useCallback(async ({ from, candidate }) => {
    const pc = peerConnections.current[from];
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  // Handle a user leaving
  const handleUserLeft = useCallback(({ socketId, name }) => {
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
  }, []);

  // Get user media on component mount
  useEffect(() => {
    if (roomId === "solo") return;

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setMyStream(stream);
      } catch (error) {
        console.error("Error accessing media devices.", error);
        toast.error("Could not access camera/microphone.");
      }
    };
    startMedia();

    return () => {
      myStream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Setup all socket event listeners
  useEffect(() => {
    if (!socket || !myStream || roomId === "solo") return;

    // A new user has joined the room, I need to initiate a connection with them.
    socket.on("user-joined", handleNewUser);
    // I received an offer from another peer
    socket.on("webrtc:offer", handleOffer);
    // I received an answer from a peer I made an offer to
    socket.on("webrtc:answer", handleAnswer);
    // I received a network candidate from a peer
    socket.on("webrtc:ice-candidate", handleIceCandidate);
    // A user has left the room
    socket.on("user-left", handleUserLeft);
    // Receive the full list of users in the room
    socket.on("update-user-list", (userList) => {
      setUsers(userList.filter((u) => u.id !== socket.id)); // All users except me
    });

    socket.on("remote-code-change", ({ code, language }) => {
      setLanguage(language);
      setValue(code);
    });

    socket.on("new-admin", () => toast("You are the new admin!"));

    // Check if user is legitimately in the room
    socket.emit("check-user", roomId, (response) => {
      if (!response.success) {
        toast.error(response.message || "Access denied. Please rejoin.");
        navigate("/");
      }
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off("user-joined", handleNewUser);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
      socket.off("user-left", handleUserLeft);
      socket.off("update-user-list");
      socket.off("remote-code-change");
      socket.off("new-admin");

      Object.values(peerConnections.current).forEach((pc) => pc.close());
      if (roomId !== "solo") {
        socket.emit("leave-room");
      }
    };
  }, [
    socket,
    myStream,
    roomId,
    navigate,
    handleNewUser,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleUserLeft,
  ]);

  const onSelect = (language) => {
    const snippet = CODE_SNIPPETS[language];
    setLanguage(language);
    setValue(snippet);
    if (socket && roomId !== "solo") {
      socket.emit("code-change", { language, code: snippet });
    }
  };

  const handleCodeChange = (newValue) => {
    setValue(newValue);
    if (socket && roomId !== "solo") {
      socket.emit("code-change", { language, code: newValue });
    }
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
        myStream={myStream}
        input={input}
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
              options={{
                padding: {
                  top: 10,
                },
                formatOnPaste: true,
              }}
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
                  {myStream && (
                    <VideoPlayer
                      stream={myStream}
                      name={`${auth?.user?.fullname} (You)`}
                      isMuted={true}
                    />
                  )}
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
