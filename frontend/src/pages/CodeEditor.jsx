import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { CODE_SNIPPETS } from "../utils/constants";
import { useAuth } from "../context/AuthProvider";
import { useSocket } from "../context/socket";
import { useMediasoup } from "../hooks/useMediasoup";
import { RoomProvider, useRoom, useStatus } from "@liveblocks/react";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import EditorHeader from "../components/EditorHeader";
import Input from "../components/Input";
import Output from "../components/Output";
import Canvas from "./Canvas";
import RoomView from "../components/RoomView";
import Modal from "../components/Alert";
import "./styles/CodeEditor.css";

function LiveblocksManager({
  editorRef,
  onLanguageChange,
  onStatusChange,
  setUpdateFn,
}) {
  const room = useRoom();
  const status = useStatus();

  const yjsRefsRef = useRef({ ytext: null, ymeta: null });

  useEffect(() => {
    onStatusChange(status !== "connected");
  }, [status, onStatusChange]);

  const updateCollabLanguage = useCallback((newLanguage, newContent) => {
    const { ytext, ymeta } = yjsRefsRef.current;
    if (ytext && ymeta) {
      ytext.doc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, "");
        ymeta.set("language", newLanguage);
      });
    }
  }, []);

  useEffect(() => {
    setUpdateFn(() => updateCollabLanguage);
  }, [setUpdateFn, updateCollabLanguage]);

  useEffect(() => {
    if (status !== "connected" || !editorRef.current) return;

    let provider;
    let binding;
    let isDestroyed = false;

    const ydoc = new Y.Doc();
    provider = new LiveblocksYjsProvider(room, ydoc);

    const ytext = ydoc.getText("monacoText");
    const ymeta = ydoc.getMap("monacoMetadata");

    yjsRefsRef.current = { ytext, ymeta };

    binding = new MonacoBinding(
      ytext,
      editorRef.current.getModel(),
      new Set([editorRef.current]),
      provider.awareness
    );

    const handleMetaChange = () => {
      if (isDestroyed) return;
      const newLang = ymeta.get("language");
      if (newLang) {
        onLanguageChange(newLang);
      }
    };
    ymeta.observe(handleMetaChange);

    const onSync = () => {
      if (isDestroyed || !editorRef.current) return;

      const currentLang = ymeta.get("language");
      if (currentLang) {
        onLanguageChange(currentLang);
      }
    };

    provider.on("synced", onSync);

    return () => {
      isDestroyed = true;
      binding?.destroy();
      provider?.off("synced", onSync);
      provider?.destroy();
      yjsRefsRef.current = { ytext: null, ymeta: null };
    };
  }, [status, room, editorRef, onLanguageChange]);

  return null;
}

const CodeEditor = () => {
  const { auth } = useAuth();
  const socket = useSocket();
  const { roomId } = useParams();
  const { state } = useLocation();
  const action = state?.action || "join";
  const isSolo = roomId === "solo";

  const {
    myStream,
    screenStream,
    remoteStreams,
    users,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    toggleMedia,
    toggleScreenShare,
  } = useMediasoup(socket, roomId, auth.user.fullname, action);

  const editorRef = useRef(null);
  const [output, setOutput] = useState(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [activeView, setActiveView] = useState("io");
  const [isUsersPanelVisible, setIsUsersPanelVisible] = useState(true);
  const [isViewVisible, setIsViewVisible] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState(null);
  const [language, setLanguage] = useState("cpp");

  const [updateCollabLanguage, setUpdateCollabLanguage] = useState(
    () => () => {}
  );
  const [isStorageLoading, setIsStorageLoading] = useState(true);

  const onLanguageChange = useCallback((newLanguage) => {
    setLanguage(newLanguage);
  }, []);

  const handleLanguageSelect = useCallback(
    (lang) => {
      if (isStorageLoading && !isSolo) return;
      if (lang === language) return;
      const editor = editorRef.current;
      const isEditorEmpty = !editor || editor.getValue().trim() === "";
      if (isEditorEmpty) {
        if (isSolo) {
          setLanguage(lang);
        } else {
          updateCollabLanguage(lang, editor.getValue() || "");
        }
      } else {
        setTargetLanguage(lang);
        setIsModalOpen(true);
      }
    },
    [language, isSolo, updateCollabLanguage, isStorageLoading]
  );

  const handleConfirmChange = useCallback(() => {
    if (!targetLanguage) return;
    if (isSolo) {
      setLanguage(targetLanguage);
    } else {
      updateCollabLanguage(targetLanguage, editorRef.current?.getValue() || "");
    }
    setIsModalOpen(false);
    setTargetLanguage(null);
  }, [targetLanguage, isSolo, updateCollabLanguage]);

  const handleCancelChange = useCallback(() => {
    setIsModalOpen(false);
    setTargetLanguage(null);
  }, []);
  const toggleUsersPanel = useCallback(() => {
    setIsUsersPanelVisible((prev) => !prev);
  }, []);
  const handleToggleAudio = useCallback(
    () => toggleMedia("audio"),
    [toggleMedia]
  );
  const handleToggleVideo = useCallback(
    () => toggleMedia("video"),
    [toggleMedia]
  );

  useEffect(() => {
    if (activeView === "whiteboard" || activeView === "io") {
      setIsViewVisible(false);
      const timer = setTimeout(() => setIsViewVisible(true), 200);
      return () => clearTimeout(timer);
    }
  }, [activeView]);

  const ioView = useMemo(
    () => (
      <Allotment vertical>
        <Allotment.Pane>
          <Input input={input} setInput={setInput} />
        </Allotment.Pane>
        <Allotment.Pane>
          <Output output={output} isLoading={isLoading} isError={isError} />
        </Allotment.Pane>
      </Allotment>
    ),
    [input, output, isLoading, isError]
  );
  const canvasView = useMemo(() => <Canvas />, []);

  const editorUI = (
    <div className="code-editor-layout">
      {!isSolo && (
        <LiveblocksManager
          editorRef={editorRef}
          onLanguageChange={onLanguageChange}
          onStatusChange={setIsStorageLoading}
          setUpdateFn={setUpdateCollabLanguage}
        />
      )}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCancelChange}
        onConfirm={handleConfirmChange}
        title="Change Language?"
      >
        <p>
          {isSolo
            ? "Changing the language will replace the current code with a default snippet. Are you sure?"
            : "Changing the language will clear the editor for everyone in the room. Are you sure?"}
        </p>{" "}
      </Modal>
      <EditorHeader
        language={language}
        onSelect={handleLanguageSelect}
        editorRef={editorRef}
        setIsError={setIsError}
        setOutput={setOutput}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        onToggleUsers={toggleUsersPanel}
        input={input}
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        toggleAudio={handleToggleAudio}
        toggleVideo={handleToggleVideo}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={toggleScreenShare}
        activeView={activeView}
        onViewChange={setActiveView}
        isLanguageSelectorDisabled={!isSolo && isStorageLoading}
      />
      <div className="content-wrapper">
        <main className="main-content">
          <Allotment>
            <Allotment.Pane preferredSize={700} minSize={400}>
              <Editor
                key={isSolo ? `solo-${language}` : "collab-editor"}
                height="100%"
                theme="vs-dark"
                language={language}
                defaultValue={isSolo ? CODE_SNIPPETS[language] : ""}
                onMount={(editor) => {
                  editorRef.current = editor;
                  if (!isSolo && editor) {
                    editor.focus();
                  }
                }}
                options={{
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  padding: { top: 10, bottom: 10 },
                  formatOnPaste: true,
                  mouseWheelZoom: true,
                }}
              />
            </Allotment.Pane>
            <Allotment.Pane minSize={250}>
              <div
                className={`view-container ${isViewVisible ? "visible" : ""}`}
              >
                {activeView === "io" ? ioView : canvasView}
              </div>
            </Allotment.Pane>
          </Allotment>
        </main>
        <div
          className={`room-view-wrapper ${
            !isSolo && isUsersPanelVisible ? "visible" : ""
          }`}
        >
          {!isSolo && (
            <RoomView
              myStream={myStream}
              screenStream={screenStream}
              remoteStreams={remoteStreams}
              users={users}
              isVideoEnabled={isVideoEnabled}
              auth={auth}
            />
          )}
        </div>
      </div>
    </div>
  );

  if (isSolo) {
    return editorUI;
  }

  return (
    <RoomProvider id={roomId} initialStorage={{}}>
      {editorUI}
    </RoomProvider>
  );
};

export default CodeEditor;