import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import EditorHeader from "../components/EditorHeader";
import Output from "../components/Output";
import { CODE_SNIPPETS } from "../constants";
import { useSocket } from "../context/socket";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { useAuth } from "../context/AuthProvider";
import toast from "react-hot-toast";
import "./CodeEditor.css";

const CodeEditor = () => {
  const { auth } = useAuth();
  const editorRef = useRef();
  const socket = useSocket();
  const navigate = useNavigate();
  const [language, setLanguage] = useState("javascript");
  const [value, setValue] = useState(CODE_SNIPPETS[language]);
  const [role, setRole] = useState("");
  const { roomId } = useParams();
  const [isError, setIsError] = useState(false);
  const [output, setOutput] = useState(null);
  const [isLoading, setIsLoading]=useState(false);

  useEffect(() => {
    if (!socket || roomId === "solo") return;

    socket.emit("check-user", roomId, (response) => {
      if (!response.success) {
        console.log("Access denied. Please rejoin.");
        toast.error(response.message || "Access denied. Please rejoin.");
        navigate("/");
      } else {
        console.log("User verified for room:", roomId);
      }
    });
  }, [socket, roomId, navigate]);

  useEffect(() => {
    return () => {
      if (socket && roomId !== "solo") {
        console.log(`Emitting leave-room for room: ${roomId}`);
        socket.emit("leave-room");
      }
    };
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket) return;

    const handleRemoteChange = ({ code, language }) => {
      setLanguage(language);
      setValue(code);
    };

    const handleNewAdmin = () => {
      toast("You are the new admin!");
    };

    const handleUserJoined = (name) => {
      toast(`${name} joined the room.`);
    };

    const handleUserLeft = (name) => {
      toast(`${name} left the room.`);
    };

    socket.on("remote-code-change", handleRemoteChange);
    socket.on("new-admin", handleNewAdmin);
    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);

    return () => {
      socket.off("remote-code-change", handleRemoteChange);
      socket.off("new-admin", handleNewAdmin);
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
    };
  }, [socket]);

  const onSelect = (language) => {
    setLanguage(language);
    const snippet = CODE_SNIPPETS[language];
    setValue(snippet);

    if (socket && roomId !== "solo") {
      socket.emit("code-change", { language: language, code: snippet });
    }
  };

  const onMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const handleCodeChange = (newValue) => {
    setValue(newValue);
    if (socket && roomId !== "solo") {
      socket.emit("code-change", {
        language,
        code: newValue,
      });
    }
  };

  useEffect(() => {
    setOutput(null);
    setIsError(false);
  }, [language]);

  return (
    <div className="main-container">
      <div className="sidebar">
        <div className="user-frame">
          {auth?.user?.fullname
            .split(" ")
            .map((name) => name[0])
            .join("")
            .toUpperCase()}
        </div>
      </div>
      <div className="editor-container">
        <EditorHeader
          language={language}
          onSelect={onSelect}
          editorRef={editorRef}
          setIsError={setIsError}
          setOutput={setOutput}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />
        <Allotment>
          <Allotment.Pane minSize={300}>
            <div className="editor-pane">
              <Editor
                className="editor"
                height="92vh" // Editor header is 8vh
                theme="vs-dark"
                language={language}
                defaultValue={CODE_SNIPPETS[language]}
                onMount={onMount}
                value={value}
                onChange={handleCodeChange}
              />
            </div>
          </Allotment.Pane>
          <Allotment.Pane minSize={300}>
            <div className="output-pane">
              <Output
                isError={isError}
                output={output}
                isLoading={isLoading}
              />
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
};

export default CodeEditor;
