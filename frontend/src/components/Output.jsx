import { Fragment } from "react";
import { VscOutput } from "react-icons/vsc";
import "./styles/Output.css";

const Output = ({ output, isLoading, isError }) => {
  const renderContent = () => {
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
      <pre className={isError ? 'output-error' : ''}>
        {output.map((line, index) => (
          <Fragment key={index}>
            {line}
            {index !== output.length - 1 && <br />}
          </Fragment>
        ))}
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