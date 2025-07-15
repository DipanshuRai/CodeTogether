import { NavLink, useNavigate } from "react-router-dom";
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
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
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
      <NavLink to="/" className="navbar-logo">
        <FaCode className="navbar-icon" />
        <h1>Code</h1>
        <span className="title-sec">Together</span>
      </NavLink>
      <div className="mid-container">
        <LanguageSelector selectedLanguage={language} onSelect={onSelect} />
        <button className="run-button" onClick={runCode} disabled={isLoading}>
          <FaPlay size={15} />
          <span>{isLoading ? "Running..." : "Run Code"}</span>
        </button>
      </div>

      <button
        className="board-btn"
        onClick={() => onViewChange(activeView === "io" ? "whiteboard" : "io")}
        title={
          activeView === "io"
            ? "Switch to Whiteboard"
            : "Switch to Input/Output"
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeView}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="btn-content"
          >
            {activeView === "io" ? (
              <>
                <PiPencilCircleFill size={20} />
                <span>Whiteboard</span>
              </>
            ) : (
              <>
                <VscOutput size={17} />
                <span>I/O</span>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </button>

      {roomId !== "solo" && (
        <div className="media-controls">
          <button
            className="control-btn"
            onClick={handleExitRoom}
            title="Leave Room"
          >
            <IoExit size={19} />
          </button>
          <button
            className="control-btn"
            onClick={copyRoomID}
            title="Copy Room ID"
          >
            <FaCopy size={15} />
          </button>
          <button
            onClick={toggleAudio}
            className={`control-btn ${!isAudioEnabled ? "disabled" : ""}`}
            title={isAudioEnabled ? "Mute" : "Unmute"}
          >
            {isAudioEnabled ? (
              <FaMicrophone size={16} />
            ) : (
              <FaMicrophoneSlash size={16} />
            )}
          </button>
          <button
            onClick={toggleVideo}
            className={`control-btn ${!isVideoEnabled ? "disabled" : ""} ${
              isScreenSharing ? "no-pointer" : ""
            }`}
            title={
              isScreenSharing
                ? "Stop screen sharing to use camera"
                : isVideoEnabled
                ? "Turn off camera"
                : "Turn on camera"
            }
          >
            {isVideoEnabled ? (
              <FaVideo size={16} />
            ) : (
              <FaVideoSlash size={16} />
            )}
          </button>
          <button
            onClick={onToggleScreenShare}
            className={`control-btn ${isScreenSharing ? "active" : ""}`}
            title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
          >
            <FaDesktop size={16} />
          </button>
          <button
            className={`control-btn`}
            onClick={onToggleUsers}
            title="Toggle Users Panel"
          >
            <FaUsers size={19} />
          </button>
        </div>
      )}
    </header>
  );
};

export default EditorHeader;