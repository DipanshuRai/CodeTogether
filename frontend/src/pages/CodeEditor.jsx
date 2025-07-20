import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { CODE_SNIPPETS } from "../utils/constants";
import { useAuth } from "../context/AuthProvider";
import { useSocket } from "../context/socket";
import { useMediasoup } from "../hooks/useMediasoup";
import EditorHeader from "../components/EditorHeader";
import Input from "../components/Input";
import Output from "../components/Output";
import Whiteboard from "./Whiteboard";
import RoomView from "../components/RoomView";
import "./styles/CodeEditor.css";
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';

let yDoc = null;
let monacoBinding = null;
let awareness = null;

const CodeEditor = () => {
  const { auth } = useAuth();
  const socket = useSocket();
  const { roomId } = useParams();

  const {
    myStream, screenStream, remoteStreams, users,
    isAudioEnabled, isVideoEnabled, isScreenSharing,
    toggleMedia, toggleScreenShare,
  } = useMediasoup(socket, roomId);

  const editorRef = useRef(null);
  const [language, setLanguage] = useState("cpp");
  const [output, setOutput] = useState(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [activeView, setActiveView] = useState("io");
  const [isUsersPanelVisible, setIsUsersPanelVisible] = useState(true);
  const [isViewVisible, setIsViewVisible] = useState(true);

  useEffect(() => {
    if (!socket || roomId === "solo" || !editorRef.current) return;

    yDoc = new Y.Doc();
    awareness = new Awareness(yDoc);

    awareness.clientID = socket.id;
    awareness.setLocalStateField('user', {
        name: auth.user.name || 'Anonymous',
        color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
        language: language,
    });

    const yText = yDoc.getText("monaco");

    monacoBinding = new MonacoBinding(
      yText,
      editorRef.current.getModel(),
      new Set([editorRef.current]),
      awareness
    );

    const onDocUpdate = (update, origin) => {
      if (origin !== socket) {
        socket.emit('crdt:update', roomId, update);
      }
    };
    yDoc.on('update', onDocUpdate);

    const onRemoteDocUpdate = (update) => {
      Y.applyUpdate(yDoc, new Uint8Array(update), socket);
    };
    socket.on('crdt:update', onRemoteDocUpdate);

    const onAwarenessUpdate = (changes) => {
      const localChanges = Array.from(changes.added).concat(Array.from(changes.updated)).filter(id => id === awareness.clientID);
      if (localChanges.length > 0) {
        const update = encodeAwarenessUpdate(awareness, localChanges);
        socket.emit('awareness:update', roomId, update);
      }

      const allUpdated = Array.from(changes.added).concat(Array.from(changes.updated));
      const awarenessStates = awareness.getStates();
      let newLanguage = null;

      allUpdated.forEach(clientID => {
        const userState = awarenessStates.get(clientID);
        if (userState?.user?.language) {
          newLanguage = userState.user.language;
        }
      });

      if (newLanguage && newLanguage !== language) {
        setLanguage(newLanguage);
      }
    };
    awareness.on('update', onAwarenessUpdate);

    const onRemoteAwarenessUpdate = (update) => {
      applyAwarenessUpdate(awareness, new Uint8Array(update), socket);
    };
    socket.on('awareness:update', onRemoteAwarenessUpdate);

    socket.emit('crdt:get-state', roomId, (initialState) => {
      if (initialState) {
        Y.applyUpdate(yDoc, new Uint8Array(initialState));
      }
      if (yText.length === 0) {
        yText.insert(0, CODE_SNIPPETS[language] || "");
      }
    });
    
    socket.emit('awareness:get-state', roomId, (initialAwarenessState) => {
        if (initialAwarenessState) {
            applyAwarenessUpdate(awareness, new Uint8Array(initialAwarenessState), socket);
        }
    });

    return () => {
      if (monacoBinding) monacoBinding.destroy();
      if (yDoc) {
        yDoc.off('update', onDocUpdate);
        yDoc.destroy();
      }
      if (awareness) {
        awareness.off('update', onAwarenessUpdate);
        awareness.destroy();
      }
      socket.off('crdt:update', onRemoteDocUpdate);
      socket.off('awareness:update', onRemoteAwarenessUpdate);
    };
  }, [socket, roomId, editorRef.current, auth.user.name]);

  const handleLanguageChange = (lang) => {
    if (yDoc && awareness) {
      const newCode = CODE_SNIPPETS[lang] || "";
      const yText = yDoc.getText("monaco");
      yDoc.transact(() => {
        yText.delete(0, yText.length);
        yText.insert(0, newCode);
      });

      const localState = awareness.getLocalState();
      awareness.setLocalStateField('user', { ...localState.user, language: lang });
    }
  };

  useEffect(() => {
    if (activeView === "whiteboard" || activeView === "io") {
      setIsViewVisible(false);
      const timer = setTimeout(() => setIsViewVisible(true), 200);
      return () => clearTimeout(timer);
    }
  }, [activeView]);

  return (
    <div className="code-editor-layout">
      <EditorHeader
        language={language}
        onSelect={handleLanguageChange}
        editorRef={editorRef}
        setIsError={setIsError}
        setOutput={setOutput}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        onToggleUsers={() => setIsUsersPanelVisible((prev) => !prev)}
        input={input}
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        toggleAudio={() => toggleMedia("audio")}
        toggleVideo={() => toggleMedia("video")}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={toggleScreenShare}
        activeView={activeView}
        onViewChange={setActiveView}
      />
      <div className="content-wrapper">
        <main className="main-content">
          <Allotment>
            <Allotment.Pane preferredSize={850} minSize={300}>
              <Editor
                height="100%"
                theme="vs-dark"
                language={language}
                onMount={(editor) => {
                  editorRef.current = editor;
                  editor.focus();
                }}
              />
            </Allotment.Pane>
            <Allotment.Pane minSize={300}>
              <div className={`view-container ${isViewVisible ? "visible" : ""}`}>
                {activeView === "io" ? (
                  <Allotment vertical>
                    <Allotment.Pane>
                      <Input input={input} setInput={setInput} />
                    </Allotment.Pane>
                    <Allotment.Pane>
                      <Output output={output} isLoading={isLoading} isError={isError} />
                    </Allotment.Pane>
                  </Allotment>
                ) : (
                  <Whiteboard />
                )}
              </div>
            </Allotment.Pane>
          </Allotment>
        </main>
        <div
          className={`room-view-wrapper ${isUsersPanelVisible && roomId !== "solo" ? "visible" : ""}`}
        >
          {roomId !== "solo" && (
            <RoomView
              myStream={myStream} screenStream={screenStream}
              remoteStreams={remoteStreams} users={users}
              isVideoEnabled={isVideoEnabled} auth={auth}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;