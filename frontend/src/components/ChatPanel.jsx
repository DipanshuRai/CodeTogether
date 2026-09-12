import { memo, useEffect, useRef, useState } from 'react';
import { FaPaperPlane, FaCommentDots, FaTimes } from 'react-icons/fa';
import './styles/Chat.css';

const ChatPanel = memo(function ChatPanel({
  messages,
  onSend,
  selfSocketId,
  open,
  onClose,
}) {
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <aside className="chat-panel" role="complementary" aria-label="Room chat">
      <header className="chat-header">
        <FaCommentDots />
        <span>Chat</span>
        <button className="chat-close" onClick={onClose} aria-label="Close chat">
          <FaTimes />
        </button>
      </header>
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-empty">No messages yet — say hi 👋</div>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={`chat-msg ${m.socketId === selfSocketId ? 'self' : 'other'}`}
          >
            <div className="chat-msg-meta">
              <span className="chat-msg-name">{m.socketId === selfSocketId ? 'You' : m.name}</span>
              <span className="chat-msg-time">
                {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="chat-msg-text">{m.text}</div>
          </div>
        ))}
      </div>
      <form className="chat-input" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={1000}
          aria-label="Chat message"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Send message">
          <FaPaperPlane />
        </button>
      </form>
    </aside>
  );
});

export default ChatPanel;
