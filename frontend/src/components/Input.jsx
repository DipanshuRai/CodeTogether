import { FaKeyboard } from "react-icons/fa";
import "./Input.css";

const Input = ({ input, setInput }) => {
    
  return (
    <div className="input-container">
      <div className="input-area">
        <div className="input-header">
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
    </div>
  );
};

export default Input;