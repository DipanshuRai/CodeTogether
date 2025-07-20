import { FaKeyboard } from "react-icons/fa";
import "./styles/Input.css";

const Input = ({ input, setInput }) => {
  return (
    <div className="input-panel">
      <div className="panel-header">
        <FaKeyboard className="header-icon" />
        <span>Input (stdin)</span>
      </div>
      <textarea
        className="input-textarea"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter any input your code needs before running..."
      />
    </div>
  );
};

export default Input;