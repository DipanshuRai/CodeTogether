import { useState, useEffect, useRef } from "react";
import LanguageSelector from "./LanguageSelector";
import { executeCode } from "../api/api.js";
import { FaPlay } from "react-icons/fa";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers } from "@fortawesome/free-solid-svg-icons";
import { useSocket } from "../context/socket.jsx";
import "./EditorHeader.css";
import { useParams } from "react-router-dom";

const EditorHeader = ({
  language,
  onSelect,
  editorRef,
  setIsError,
  setOutput,
  isLoading,
  setIsLoading,
}) => {
  const socket = useSocket();
  const [userList, setUserList] = useState([]);
  const { roomId } = useParams();
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const userListRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleUserListUpdate = (users) => {
      setUserList(users);
    };

    socket.on("update-user-list", handleUserListUpdate);
    return () => {
      socket.off("update-user-list", handleUserListUpdate);
    };
  }, [socket]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userListRef.current && !userListRef.current.contains(event.target)) {
        setIsUserListOpen(false);
      }
    };
    if (isUserListOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserListOpen]);

  const runCode = async () => {
    const sourceCode = editorRef.current.getValue();
    if (!sourceCode) return;
    try {
      setIsLoading(true);
      const { run: result } = await executeCode(language, sourceCode);
      setOutput(result.output.split("\n"));
      result.stderr ? setIsError(true) : setIsError(false);
    } catch (error) {
      console.error(error);
      setOutput(["An error occurred while running the code."]);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="editor-header">
      <LanguageSelector language={language} onSelect={onSelect} />
      <button className="run-button" onClick={runCode} disabled={isLoading}>
        <FaPlay />
        <span>{isLoading ? "Running..." : "Run Code"}</span>
      </button>

      <div className="util-container" ref={userListRef}>
        {roomId !== "solo" && (
          <>
            <div
              className="users"
              onClick={() => setIsUserListOpen((prev) => !prev)}
            >
              <FontAwesomeIcon icon={faUsers} />
            </div>
            {isUserListOpen && (
              <div className="user-list-popup">
                <h4>Connected Users ({userList.length})</h4>
                <ul>
                  {userList.length > 0 ? (
                    userList.map((user, index) => <li key={index}>{user}</li>)
                  ) : (
                    <li className="no-users">Just you for now!</li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EditorHeader;
