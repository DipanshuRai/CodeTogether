import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Editor } from "@monaco-editor/react";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { CODE_SNIPPETS } from "../utils/constants";
import { useAuth } from "../context/AuthProvider";
import { useSocket } from "../context/socket";
import { useMediasoup } from "../hooks/useMediasoup";
import { useYjs } from "../hooks/useYjs";
import EditorHeader from "../components/EditorHeader";
import Input from "../components/Input";
import Output from "../components/Output";
import Whiteboard from "./Whiteboard";
import RoomView from "../components/RoomView";
import Modal from "../components/Alert";
import "./styles/CodeEditor.css";

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

  const isSolo = roomId === "solo";

  const { updateCollabLanguage } = useYjs({
    socket,
    roomId,
    user: auth?.user,
    editorRef,
    language,
    onLanguageChange: (newLanguage) => {
      setLanguage(newLanguage);
    },
    enabled: !isSolo && auth?.user
  });

  const handleLanguageSelect = (lang) => {
    if (lang !== language) {
      if (isSolo) {
        setLanguage(lang);
      } else {
        setTargetLanguage(lang);
        setIsModalOpen(true);
      }
    }
  };

  // After confirmation, this function executes the appropriate change
  const handleConfirmChange = () => {
    if (!targetLanguage) return;

    // For collab mode, update through Yjs.
    // The local language state will be updated via the onLanguageChange callback
    // for consistency, but we can also set it immediately for responsiveness.
    updateCollabLanguage(targetLanguage);
    setLanguage(targetLanguage);
    
    setIsModalOpen(false);
    setTargetLanguage(null);
  };

  const handleCancelChange = () => {
    setIsModalOpen(false);
    setTargetLanguage(null);
  };
  
  // Effect to manage the slide-in animation for the right-hand view
  useEffect(() => {
    if (activeView === "whiteboard" || activeView === "io") {
      setIsViewVisible(false);
      const timer = setTimeout(() => setIsViewVisible(true), 200);
      return () => clearTimeout(timer);
    }
  }, [activeView]);

  return (
    <div className="code-editor-layout">
      {!isSolo && (
        <Modal
          isOpen={isModalOpen}
          onClose={handleCancelChange}
          onConfirm={handleConfirmChange}
          title="Change Language?"
        >
          <p>This will replace the current code in the editor for everyone. Are you sure?</p>
        </Modal>
      )}

      <EditorHeader
        language={language}
        onSelect={handleLanguageSelect}
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
                key={isSolo ? `solo-${language}` : 'collab-editor'}
                height="100%"
                theme="vs-dark"
                language={language}
                defaultValue={isSolo ? CODE_SNIPPETS[language] : ""}
                onMount={(editor) => {
                  editorRef.current = editor;
                  // editor.getModel()?.setEOL(monaco.editor.EndOfLineSequence.LF);
                  if (!isSolo && editor) {
                    editor.focus();
                  }
                }}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
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
          className={`room-view-wrapper ${!isSolo && isUsersPanelVisible ? "visible" : ""}`}
        >
          {!isSolo && (
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