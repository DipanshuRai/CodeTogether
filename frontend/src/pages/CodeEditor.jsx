import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import EditorHeader from "../components/EditorHeader";
import Output from "../components/Output";
import { CODE_SNIPPETS } from "../constants";
import { useSocket } from "../context/socket";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import "./CodeEditor.css";
import { useAuth } from "../context/AuthProvider";
import toast from "react-hot-toast";

const CodeEditor = () => {
  const { auth } = useAuth();
  const editorRef = useRef();
  const socket = useSocket();
  const navigate = useNavigate();
  const [language, setLanguage] = useState("javascript");
  const [value, setValue] = useState(CODE_SNIPPETS[language]);
  const [role, setRole] = useState("");

  const { roomId: urlRoomId } = useParams();

  useEffect(() => {
    if (!auth.user) {
      navigate("/login");
    }
  }, [auth, navigate]);

  useEffect(() => {
    if (!socket) return;

    const handleRoomJoined = ({ role, roomId }) => {
      console.log("Room joined: ", role, roomId);
      setRole(role === "admin" ? "Admin" : "User");
      toast.success(
        `Room ${roomId} ${role === "admin" ? "created" : "joined"}`
      );
    };

    // socket.on("room-joined", handleRoomJoined);
    socket.on("room-joined", ({role, roomId})=>{
      console.log("Role: ",role);
      console.log("RooomID: ",roomId);
    });

    socket.on("new-admin", () => {
      toast.success("The admin left. You are the new admin!");
      setRole("Admin");
    });

    return () => {
      socket.off("room-joined", handleRoomJoined);
      socket.off("new-admin");
    };
  }, [socket]);

  const onSelect = (language) => {
    setLanguage(language);
    const snippet = CODE_SNIPPETS[language];
    setValue(snippet);

    if (socket) {
      socket.emit("code-change", { language: language, code: snippet });
    }
  };

  const onMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const handleCodeChange = (newValue) => {
    setValue(newValue);
    if (socket) {
      socket.emit("code-change", {
        roomId: urlRoomId,
        language,
        code: newValue,
      });
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleRemoteChange = ({ code, language }) => {
      setLanguage(language);
      setValue(code);
    };

    socket.on("remote-code-change", handleRemoteChange);

    return () => {
      socket.off("remote-code-change", handleRemoteChange);
    };
  }, [socket]);

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
        <Allotment>
          <Allotment.Pane minSize={400}>
            <div className="editor-pane">
              <EditorHeader language={language} onSelect={onSelect} />
              <Editor
                className="editor"
                height="100%"
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
              <Output editorRef={editorRef} language={language} />
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
};

export default CodeEditor;
