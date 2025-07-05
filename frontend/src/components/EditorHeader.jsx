import { NavLink } from "react-router-dom";
import { executeCode } from "../api/executeCode.js";
import LanguageSelector from "./LanguageSelector";
import {
  FaPlay,
  FaUsers,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaCode,
  FaCopy,
} from "react-icons/fa";
import { useParams } from "react-router-dom";
import "./EditorHeader.css";
import toast from "react-hot-toast";

const EditorHeader = ({
  language,
  onSelect,
  editorRef,
  setIsError,
  setOutput,
  isLoading,
  setIsLoading,
  onToggleUsers,
  input,
  // Receive controls from parent
  isAudioEnabled,
  isVideoEnabled,
  toggleAudio,
  toggleVideo,
}) => {
  const { roomId } = useParams();

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

  const copyRoomID = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID copied");
    } catch (err) {
      console.error("Failed to copy: ", err);
      toast.error("Could not copy Room ID");
    }
  };

  return (
    <header className="editor-header">
      <NavLink to="/" className="navbar-logo">
        <FaCode className="navbar-icon" />
        <h1>Code</h1>
        <span className="title2">Together</span>
      </NavLink>
      <LanguageSelector selectedLanguage={language} onSelect={onSelect} />
      <button className="run-button" onClick={runCode} disabled={isLoading}>
        <FaPlay />
        <span>{isLoading ? "Running..." : "Run Code"}</span>
      </button>

      {roomId !== "solo" && (
        <div className="media-controls">
          <button className="control-btn" onClick={copyRoomID} title="Copy Room ID">
            <FaCopy />
          </button>
          <button
            onClick={toggleAudio}
            className={`control-btn ${!isAudioEnabled ? "disabled" : ""}`}
            title={isAudioEnabled ? "Mute" : "Unmute"}
          >
            {isAudioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>
          <button
            onClick={toggleVideo}
            className={`control-btn ${!isVideoEnabled ? "disabled" : ""}`}
            title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
          </button>
          <button className={`control-btn`} onClick={onToggleUsers} title="Toggle Users Panel">
            <FaUsers />
          </button>
        </div>
      )}
    </header>
  );
};

export default EditorHeader;