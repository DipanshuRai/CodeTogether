import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import './styles/WhiteboardPane.css';

// In-editor whiteboard tile. The parent (Allotment pane) controls sizing —
// we just fill it. For the standalone /canvas route see pages/Canvas.jsx.
const WhiteboardPane = () => (
  <div className="whiteboard-pane">
    <Tldraw />
  </div>
);

export default WhiteboardPane;
