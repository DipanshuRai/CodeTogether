import { Fragment, useEffect, useState } from 'react';
import { VscOutput } from 'react-icons/vsc';
import './styles/Output.css';

// Streaming UX: even though Piston returns the result in one chunk, we reveal
// the lines progressively so the user has visible feedback instead of a long
// blank wait. Pure presentation — no extra network calls.
const REVEAL_INTERVAL_MS = 25;

const Output = ({ output, isLoading, isError }) => {
  const [revealed, setRevealed] = useState([]);

  useEffect(() => {
    if (!output) { setRevealed([]); return undefined; }
    setRevealed([]);
    let idx = 0;
    const id = setInterval(() => {
      idx += 1;
      setRevealed(output.slice(0, idx));
      if (idx >= output.length) clearInterval(id);
    }, REVEAL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [output]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="loading-stages">
          <div className="loader" />
          <div className="loading-text">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
            <span>Running…</span>
          </div>
        </div>
      );
    }

    if (!output) {
      return (
        <span className="output-placeholder">
          Click &quot;Run Code&quot; to see the output here.
        </span>
      );
    }

    return (
      <pre className={isError ? 'output-error' : ''}>
        {revealed.map((line, index) => (
          <Fragment key={index}>
            {line}
            {index !== revealed.length - 1 && <br />}
          </Fragment>
        ))}
        {revealed.length < output.length && <span className="cursor-blink">▍</span>}
      </pre>
    );
  };

  return (
    <div className="output-panel">
      <div className="panel-header">
        <VscOutput className="header-icon" />
        <span>Output (stdout)</span>
      </div>
      <div className="output-body">{renderContent()}</div>
    </div>
  );
};

export default Output;
