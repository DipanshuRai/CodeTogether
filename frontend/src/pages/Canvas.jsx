import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import './styles/Canvas.css';

// Standalone whiteboard route. tldraw needs an explicitly sized parent, so
// the container is locked to the viewport.
const Canvas = () => {
  const navigate = useNavigate();
  return (
    <div className="whiteboard-container">
      <button
        type="button"
        className="whiteboard-back-btn"
        onClick={() => navigate(-1)}
        title="Go back"
        aria-label="Go back"
      >
        <FaArrowLeft size={14} />
        <span>Back</span>
      </button>
      <div className="whiteboard-stage">
        <Tldraw />
      </div>
    </div>
  );
};

export default Canvas;
