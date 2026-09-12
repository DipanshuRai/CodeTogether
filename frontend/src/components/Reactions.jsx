import { memo } from 'react';
import './styles/Reactions.css';

const PICKER_EMOJIS = ['👍', '👏', '🎉', '❤️', '😂', '😮', '🤔', '🔥'];

export const ReactionPicker = memo(function ReactionPicker({ onPick, open, onClose }) {
  if (!open) return null;
  return (
    <div className="reaction-picker" role="menu">
      {PICKER_EMOJIS.map(e => (
        <button
          key={e}
          onClick={() => { onPick(e); onClose?.(); }}
          aria-label={`React ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
});

export const ReactionsOverlay = memo(function ReactionsOverlay({ reactions }) {
  if (!reactions?.length) return null;
  return (
    <div className="reactions-overlay" aria-hidden="true">
      {reactions.map(r => (
        <div key={r.id} className="reaction-bubble">
          <span className="reaction-emoji">{r.emoji}</span>
          <span className="reaction-name">{r.name}</span>
        </div>
      ))}
    </div>
  );
});
