import { useState, useRef, useEffect, memo } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
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
  FaHandPaper,
  FaCommentDots,
  FaSmile,
  FaChartLine,
} from 'react-icons/fa';
import { PiPencilCircleFill } from 'react-icons/pi';
import { VscOutput } from 'react-icons/vsc';
import { IoExit } from 'react-icons/io5';
import toast from 'react-hot-toast';
import LanguageSelector from './LanguageSelector';
import { ReactionPicker } from './Reactions';
import { Piston } from '../api/piston.js';
import './styles/EditorHeader.css';

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
  isLanguageSelectorDisabled,
  // New props (all optional so solo mode still works).
  onToggleChat,
  chatUnread,
  onToggleRaiseHand,
  handRaised,
  onPickReaction,
  onToggleStats,
}) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const reactionAnchorRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const close = (e) => {
      if (!reactionAnchorRef.current?.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pickerOpen]);

  const runCode = async () => {
    const sourceCode = editorRef.current?.getValue();
    if (!sourceCode || !sourceCode.trim()) {
      toast.error('Nothing to run — editor is empty');
      return;
    }
    try {
      setIsLoading(true);
      const result = await Piston(language, sourceCode, input);
      // Piston v2 response: { language, version, run: { stdout, stderr, output, code, signal }, compile?: {...} }
      const compile = result?.compile;
      const run = result?.run || {};
      const compileFailed = compile && compile.code !== 0 && (compile.stderr || compile.output);
      const text = compileFailed
        ? (compile.stderr || compile.output || '')
        : (run.output ?? `${run.stdout || ''}${run.stderr || ''}`);
      const lines = (text || '(no output)').split('\n');
      setOutput(lines);
      setIsError(Boolean(compileFailed) || Boolean(run.stderr) || (run.code != null && run.code !== 0));
    } catch (error) {
      console.error('Run failed:', error);
      const msg = error?.message || 'An error occurred while running the code.';
      setOutput([msg]);
      setIsError(true);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExitRoom = () => {
    toast.success('Room left');
    navigate('/');
  };

  const copyRoomID = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success('Room ID copied');
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Could not copy Room ID');
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
        <LanguageSelector
          selectedLanguage={language}
          onSelect={onSelect}
          disabled={isLanguageSelectorDisabled}
        />
        <button className="action-btn run-button" onClick={runCode} disabled={isLoading}>
          <FaPlay size={15} />
          <span>{isLoading ? 'Running…' : 'Run Code'}</span>
        </button>
        <button
          className="action-btn board-btn"
          onClick={() => onViewChange(activeView === 'io' ? 'whiteboard' : 'io')}
          title={activeView === 'io' ? 'Switch to Whiteboard' : 'Switch to Input/Output'}
        >
          <div key={activeView} className="btn-content-animated">
            {activeView === 'io' ? (<><PiPencilCircleFill size={20} /><span>Canvas</span></>)
              : (<><VscOutput size={17} /><span>I/O</span></>)}
          </div>
        </button>
      </div>

      <div className="header-section header-right">
        {roomId !== 'solo' && (
          <div className="media-controls">
            {onToggleChat && (
              <button
                className={`control-btn ${chatUnread ? 'badge' : ''}`}
                onClick={onToggleChat}
                title="Open chat"
                aria-label="Open chat"
              >
                <FaCommentDots size={16} />
                {chatUnread > 0 && <span className="control-badge">{chatUnread}</span>}
              </button>
            )}
            {onToggleRaiseHand && (
              <button
                className={`control-btn ${handRaised ? 'active' : ''}`}
                onClick={onToggleRaiseHand}
                title={handRaised ? 'Lower hand' : 'Raise hand'}
                aria-label="Raise hand"
              >
                <FaHandPaper size={16} />
              </button>
            )}
            {onPickReaction && (
              <div ref={reactionAnchorRef} style={{ position: 'relative' }}>
                <button
                  className="control-btn"
                  onClick={() => setPickerOpen(o => !o)}
                  title="React"
                  aria-label="React with emoji"
                >
                  <FaSmile size={16} />
                </button>
                <ReactionPicker
                  open={pickerOpen}
                  onPick={onPickReaction}
                  onClose={() => setPickerOpen(false)}
                />
              </div>
            )}
            {onToggleStats && (
              <button
                className="control-btn"
                onClick={onToggleStats}
                title="Network stats"
                aria-label="Show network stats"
              >
                <FaChartLine size={16} />
              </button>
            )}
            <button className="control-btn" onClick={onToggleUsers} title="Toggle Users Panel">
              <FaUsers size={19} />
            </button>
            <button
              onClick={onToggleScreenShare}
              className={`control-btn ${isScreenSharing ? 'active' : ''}`}
              title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            >
              <FaDesktop size={16} />
            </button>
            <button
              onClick={toggleVideo}
              className={`control-btn ${!isVideoEnabled ? 'disabled' : ''}`}
              title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              {isVideoEnabled ? <FaVideo size={16} /> : <FaVideoSlash size={16} />}
            </button>
            <button
              onClick={toggleAudio}
              className={`control-btn ${!isAudioEnabled ? 'disabled' : ''}`}
              title={isAudioEnabled ? 'Mute' : 'Unmute'}
            >
              {isAudioEnabled ? <FaMicrophone size={16} /> : <FaMicrophoneSlash size={16} />}
            </button>
            <button className="control-btn" onClick={copyRoomID} title="Copy Room ID">
              <FaCopy size={15} />
            </button>
            <button className="control-btn" onClick={handleExitRoom} title="Leave Room">
              <IoExit size={19} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default memo(EditorHeader);
