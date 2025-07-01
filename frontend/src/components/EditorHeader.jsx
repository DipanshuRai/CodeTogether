import { useState } from "react";
import { executeCode } from "../api/executeCode.js";
import LanguageSelector from "./LanguageSelector";
import {
  FaPlay,
  FaUsers,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
} from "react-icons/fa";
import { useParams } from "react-router-dom";
import "./EditorHeader.css";

const EditorHeader = ({
  language,
  onSelect,
  editorRef,
  setIsError,
  setOutput,
  isLoading,
  setIsLoading,
  onToggleUsers,
  myStream,
  input,
}) => {
  const { roomId } = useParams();
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const toggleAudio = () => {
    myStream
      .getAudioTracks()
      .forEach((track) => (track.enabled = !isAudioEnabled));
    setIsAudioEnabled(!isAudioEnabled);
  };

  const toggleVideo = () => {
    myStream
      .getVideoTracks()
      .forEach((track) => (track.enabled = !isVideoEnabled));
    setIsVideoEnabled(!isVideoEnabled);
  };

  const runCode = async () => {
    const sourceCode = editorRef.current.getValue();
    
    if (!sourceCode) return;
    try {
      setIsLoading(true);
      const { run: result } = await executeCode(language, sourceCode, input);
      setOutput(result.output.split("\n"));
      result.stderr ? setIsError(true) : setIsError(false);
    } catch (error) {
      console.error(error);
      setOutput(["An error occurred while running the code."]);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="editor-header">
      <LanguageSelector language={language} onSelect={onSelect} />
      <button className="run-button" onClick={runCode} disabled={isLoading}>
        <FaPlay />
        <span>{isLoading ? "Running..." : "Run Code"}</span>
      </button>

      {roomId !== "solo" && (
        <div className="media-controls">
          <button
            onClick={toggleAudio}
            className={`control-btn ${!isAudioEnabled ? "disabled" : ""}`}
          >
            {isAudioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>
          <button
            onClick={toggleVideo}
            className={`control-btn ${!isVideoEnabled ? "disabled" : ""}`}
          >
            {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
          </button>
          <button className={`control-btn`} onClick={onToggleUsers}>
            <FaUsers />
          </button>
        </div>
      )}
    </div>
  );
};

export default EditorHeader;
