import { NavLink, useNavigate, useParams } from "react-router-dom";
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
  FaDesktop,
} from "react-icons/fa";
import { PiPencilCircleFill } from "react-icons/pi";
import { VscOutput } from "react-icons/vsc";
import { IoExit } from "react-icons/io5";
import toast from "react-hot-toast";
import "./styles/EditorHeader.css";

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
  isAudioEnabled,
  isVideoEnabled,
  toggleAudio,
  toggleVideo,
  activeView,
  onViewChange,
  isScreenSharing,
  onToggleScreenShare,
}) => {
  const { roomId } = useParams();
  const navigate = useNavigate();

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

  const handleExitRoom = () => {
    toast.success("Room left");
    navigate("/");
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
      <div className="header-section header-left">
        <NavLink to="/" className="navbar-logo">
          <FaCode className="navbar-icon" />
          <h1>Code</h1>
          <span className="title-sec">Together</span>
        </NavLink>
      </div>

      <div className="header-section header-center">
        <LanguageSelector selectedLanguage={language} onSelect={onSelect} />
        <button className="action-btn run-button" onClick={runCode} disabled={isLoading}>
          <FaPlay size={15} />
          <span>{isLoading ? "Running..." : "Run Code"}</span>
        </button>
        <button
          className="action-btn board-btn"
          onClick={() => onViewChange(activeView === "io" ? "whiteboard" : "io")}
          title={
            activeView === "io"
              ? "Switch to Whiteboard"
              : "Switch to Input/Output"
          }
        >
          <div key={activeView} className="btn-content-animated">
            {activeView === "io" ? (
              <>
                <PiPencilCircleFill size={20} />
                <span>Canvas</span>
              </>
            ) : (
              <>
                <VscOutput size={17} />
                <span>I/O</span>
              </>
            )}
          </div>
        </button>
      </div>

      <div className="header-section header-right">
        {roomId !== "solo" && (
          <div className="media-controls">
            <button className="control-btn" onClick={onToggleUsers} title="Toggle Users Panel">
              <FaUsers size={19} />
            </button>
            <button onClick={onToggleScreenShare} className={`control-btn ${isScreenSharing ? "active" : ""}`} title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
              <FaDesktop size={16} />
            </button>
            <button
              onClick={toggleVideo}
              className={`control-btn ${!isVideoEnabled ? "disabled" : ""}`}
              title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {isVideoEnabled ? <FaVideo size={16} /> : <FaVideoSlash size={16} />}
            </button>
            <button onClick={toggleAudio} className={`control-btn ${!isAudioEnabled ? "disabled" : ""}`} title={isAudioEnabled ? "Mute" : "Unmute"}>
              {isAudioEnabled ? <FaMicrophone size={16} /> : <FaMicrophoneSlash size={16} />}
            </button>
            <button className="control-btn" onClick={copyRoomID} title="Copy Room ID"><FaCopy size={15} /></button>
            <button className="control-btn" onClick={handleExitRoom} title="Leave Room"><IoExit size={19} /></button>
          </div>
        )}
      </div>
    </header>
  );
};

export default EditorHeader;