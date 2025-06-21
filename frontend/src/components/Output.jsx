import { useEffect, useState, Fragment } from 'react';
import { executeCode } from '../api/api.js';
import './Output.css';
import { FaPlay, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const Output = ({ editorRef, language }) => {
  const [output, setOutput] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setOutput(null);
    setIsError(false);
  }, [language]);

  const runCode = async () => {
    const sourceCode = editorRef.current.getValue();
    if (!sourceCode) return;
    try {
      setIsLoading(true);
      const { run: result } = await executeCode(language, sourceCode);
      setOutput(result.output.split('\n'));
      result.stderr ? setIsError(true) : setIsError(false);
    } catch (error) {
      console.error(error);
      setOutput(['An error occurred while running the code.']);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const renderOutput = () => {
    if (isLoading) {
      return <div className="loader"></div>;
    }

    if (!output) {
      return (
        <span className="output-placeholder">
          Click "Run Code" to see the output here.
        </span>
      );
    }

    return (
      <div
        className={`output-content ${isError ? 'error' : 'success'}`}
      >
        <div className="output-status">
          {isError ? (
            <>
              <FaTimesCircle className="status-icon error" />
              <span>Error</span>
            </>
          ) : (
            <>
              <FaCheckCircle className="status-icon success" />
              <span>Success</span>
            </>
          )}
        </div>
        <pre>
          {output.map((line, index) => (
            <Fragment key={index}>
              {line}
              {index !== output.length - 1 && <br />}
            </Fragment>
          ))}
        </pre>
      </div>
    );
  };

  return (
    <div className="output-container">
      <div className="output-header">
        <h3>Output</h3>
        <button className="run-button" onClick={runCode} disabled={isLoading}>
          <FaPlay />
          <span>{isLoading ? 'Running...' : 'Run Code'}</span>
        </button>
      </div>

      <div className="output-area">{renderOutput()}</div>
    </div>
  );
};

export default Output;