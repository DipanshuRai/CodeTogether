import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ReactSketchCanvas } from "react-sketch-canvas";
import { FaCode } from "react-icons/fa";
import { Pen, Eraser, Undo, Redo, Trash2, Download } from "lucide-react";
import "./styles/Whiteboard.css";

const TOOLS = {
  PEN: "pen",
  ERASER: "eraser",
};

const VIBRANT_COLORS = [
  "#FFFFFF",
  "#FF9500",
  "#4CD964",
  "#00A9FF",
  "#5856D6",
  "#FF2D55",
];

const Whiteboard = () => {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState(TOOLS.PEN);
  const [strokeColor, setStrokeColor] = useState("#FFFFFF");
  const [brushSize, setBrushSize] = useState(4);
  const [canvasColor] = useState("#555555ff");

  const handleClear = () => canvasRef.current?.clearCanvas();
  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();

  const handleDownload = () =>
    canvasRef.current
      ?.exportImage("png")
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "whiteboard.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch(console.error);

  const setEraserTool = () => {
    setTool(TOOLS.ERASER);
    canvasRef.current?.eraseMode(true);
  };

  const setPenTool = () => {
    setTool(TOOLS.PEN);
    canvasRef.current?.eraseMode(false);
  };

  const selectColor = (color) => {
    setStrokeColor(color);
    setPenTool();
  };

  return (
    <div className="whiteboard-container">
      <div className="toolbar">
        {/* <div className="tool-group">
          <Link to="/" className="board-logo">
            <FaCode className="navbar-icon" />
          </Link>
        </div> */}

        <div className="tool-group">
          <button
            onClick={setPenTool}
            className={tool === TOOLS.PEN ? "active" : ""}
            title="Pen"
          >
            <Pen size={18} />
          </button>
          <button
            onClick={setEraserTool}
            className={tool === TOOLS.ERASER ? "active" : ""}
            title="Eraser"
          >
            <Eraser size={18} />
          </button>
        </div>

        <div className="separator"></div>

        <div className="tool-group">
          <div className="stroke-slider-container">
            <input
              type="range"
              min="2"
              max="30"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
              className="stroke-slider"
              title={`Brush Size: ${brushSize}px`}
            />
            <span className="slider-value">{brushSize}</span>
          </div>
        </div>

        <div className="separator"></div>

        <div className="tool-group">
          <div className="color-palette">
            {VIBRANT_COLORS.map((color) => (
              <button
                key={color}
                style={{ backgroundColor: color }}
                className={`color-swatch ${
                  strokeColor === color && tool === TOOLS.PEN ? "active" : ""
                }`}
                onClick={() => selectColor(color)}
                title={color}
              />
            ))}
          </div>
        </div>

        <div className="separator"></div>

        <div className="tool-group">
          <button onClick={handleUndo} title="Undo">
            <Undo size={18} />
          </button>
          <button onClick={handleRedo} title="Redo">
            <Redo size={18} />
          </button>
          <button onClick={handleClear} title="Clear All">
            <Trash2 size={18} />
          </button>
          <button onClick={handleDownload} title="Download">
            <Download size={18} />
          </button>
        </div>
      </div>

      <ReactSketchCanvas
        ref={canvasRef}
        className="sketch-canvas"
        strokeWidth={brushSize}
        eraserWidth={brushSize}
        strokeColor={strokeColor}
        canvasColor={canvasColor}
        withTimestamp={false}
        allowOnlyPointerType="all"
      />
    </div>
  );
};

export default Whiteboard;
