import { useRef, useEffect, useCallback, useState } from "react";
import { ReactSketchCanvas } from "react-sketch-canvas";
import { useSocket } from "../context/socket";
import { FaTrash, FaUndo, FaDownload, FaMinus, FaPlus, FaEraser, FaPen, FaSquare } from "react-icons/fa";
import "./Whiteboard.css";

const TOOLS = {
  PEN: "pen",
  ERASER: "eraser",
};

const Whiteboard = () => {
  const socket = useSocket();
  const canvasRef = useRef(null);

  // State Management
  const [tool, setTool] = useState(TOOLS.PEN);
  const [strokeColor, setStrokeColor] = useState("white");
  const [strokeWidth, setStrokeWidth] = useState(4);

  const colors = ["white", "#ff0000", "#00ff00", "#00ffff", "#ffff00", "#ff00ff"];


  // Function to send the entire canvas state to the server
  const sendStateToServer = useCallback(() => {
    if (!socket || !canvasRef.current) return;
    canvasRef.current.exportPaths()
      .then(paths => {
        socket.emit("whiteboard:set-state", { paths });
      })
      .catch(console.error);
  }, [socket]);

  // Handler for receiving state updates from the server
  const handleStateUpdate = useCallback((data) => {
    if (canvasRef.current) {
      canvasRef.current.resetCanvas();
      canvasRef.current.loadPaths(data.paths);
    }
  }, []);
  
  // Effect to set up socket listeners
  useEffect(() => {
    if (!socket) return;
    
    socket.on("whiteboard:state-update", handleStateUpdate);
    socket.emit("whiteboard:get-state");

    return () => {
      socket.off("whiteboard:state-update", handleStateUpdate);
    };
  }, [socket, handleStateUpdate]);

  const handleDraw = useCallback(async (updatedPath) => {    
    sendStateToServer();
  }, [tool, sendStateToServer]);

  const handleClear = () => {
    if (!socket || !canvasRef.current) return;
    canvasRef.current.resetCanvas();
    socket.emit("whiteboard:set-state", { paths: [] });
  };
  
  const handleUndo = async () => {
    // Undo now just removes the last path and sends the new state
    if (!socket || !canvasRef.current) return;
    const allPaths = await canvasRef.current.exportPaths();
    if (allPaths.length > 0) {
      allPaths.pop();
      canvasRef.current.resetCanvas();
      canvasRef.current.loadPaths(allPaths);
      socket.emit("whiteboard:set-state", { paths: allPaths });
    }
  };

  const handleDownload = () => canvasRef.current?.exportImage("png").then(dataUrl => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "whiteboard.png";
    link.click();
  }).catch(console.error);
  
  const changeStrokeWidth = (delta) => setStrokeWidth((prev) => Math.max(2, Math.min(50, prev + delta)));

  const selectColor = (color) => {
    setStrokeColor(color);
    setTool(TOOLS.PEN);
  };
  
  return (
    <div className="whiteboard-container">
      <div className="whiteboard-controls">
        <button onClick={() => setTool(TOOLS.PEN)} className={tool === TOOLS.PEN ? 'active' : ''} title="Pen"><FaPen /></button>
        <button onClick={() => setTool(TOOLS.ERASER)} className={tool === TOOLS.ERASER ? 'active' : ''} title="Eraser"><FaEraser /></button>
        
        <div className="separator"></div>

        <button onClick={handleUndo} title="Undo"><FaUndo /></button>
        <button onClick={handleClear} title="Clear All"><FaTrash /></button>
        <button onClick={handleDownload} title="Download"><FaDownload /></button>

        <div className="separator"></div>

        <div className="stroke-controls">
          <button onClick={() => changeStrokeWidth(-2)}><FaMinus /></button>
          <span>{strokeWidth}</span>
          <button onClick={() => changeStrokeWidth(2)}><FaPlus /></button>
        </div>

        <div className="separator"></div>

        <div className="color-palette">
          {colors.map((color) => (
            <button
              key={color}
              style={{ backgroundColor: color }}
              className={`color-swatch ${strokeColor === color && tool === TOOLS.PEN ? 'active' : ''}`}
              onClick={() => selectColor(color)}
            />
          ))}
        </div>
      </div>
      <div className="canvas-wrapper">
        <ReactSketchCanvas
          ref={canvasRef}
          className="sketch-canvas"
          strokeWidth={strokeWidth}
          eraserWidth={tool === TOOLS.ERASER ? strokeWidth : 0}
          strokeColor={strokeColor}
          canvasColor="#2d2d2d"
          onUpdate={handleDraw}
        />
      </div>
    </div>
  );
};

export default Whiteboard;