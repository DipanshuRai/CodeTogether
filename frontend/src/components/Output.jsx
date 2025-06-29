import { Fragment } from "react";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import "./Output.css";

const Output = ({ isError, output, isLoading }) => {
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
      <div className={`output-content ${isError ? "error" : "success"}`}>
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
      <div className="output-area">{renderOutput()}</div>
    </div>
  );
};

export default Output;
