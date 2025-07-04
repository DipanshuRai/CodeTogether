import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaUsers, FaCodeBranch, FaTerminal } from "react-icons/fa";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import { useAuth } from "../context/AuthProvider.jsx";
import { useSocket } from "../context/socket.jsx";
import toast from "react-hot-toast";
import { BeatLoader } from "react-spinners";
import "./Home.css";

const Home = () => {
  const { auth } = useAuth();
  const socket = useSocket();
  const isAuthenticated = auth?.user ? true : false;
  const navigate = useNavigate();

  const [modalType, setModalType] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenModal = (type) => {
    if (isAuthenticated) {
      setModalType(type);
    } else {
      navigate("/login");
    }
  };

  const handleCloseModal = () => {
    setModalType(null);
    setRoomId("");
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!roomId.trim()) {
      toast.error("Provide Room ID");
      return;
    }
    if (!socket) {
      toast.error("Server error");
      return;
    }
    setIsSubmitting(true);

    const eventToEmit = modalType === "create" ? "create-room" : "join-room";

    socket.emit(eventToEmit, roomId, auth?.user?.fullname, (response) => {
      setIsSubmitting(false);

      if (response.success) {
        toast.success(response.message);
        navigate(`/code-editor/${response.roomId}`);
      } else {
        toast.error(response.message);
      }
    });
  };

  const handleAutoGenerateRoomID = () => {
    const generateIdSegment = (length = 3) => {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let id = "";
      for (let i = 0; i < length; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return id;
    };

    const randomRoomId=[generateIdSegment(), generateIdSegment(), generateIdSegment()].join('-');
    setRoomId(randomRoomId);
  };

  return (
    <>
      <Navbar />
      <main className="homepage">
        {modalType && (
          <div className="modal-overlay" onClick={handleCloseModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-button" onClick={handleCloseModal}>
                X
              </button>
              <h2>{modalType === "create" ? "Create Room" : "Join Room"}</h2>
              <form className="modal-form" onSubmit={handleFormSubmit}>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="Enter Room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  required
                />
                {modalType === "create" && <div
                  className="auto-generate"
                  onClick={() => handleAutoGenerateRoomID()}
                >
                  Generate
                </div>}
                <button
                  className="hero-cta-button modal-submit-button"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <BeatLoader />
                  ) : modalType === "create" ? (
                    "Create"
                  ) : (
                    "Join"
                  )}{" "}
                </button>
              </form>
            </div>
          </div>
        )}
        <section className="hero-section">
          <div className="container">
            <h1 className="hero-title">
              Collaborate in Real-Time, Build Faster.
            </h1>
            <p className="hero-subtitle">
              The ultimate collaborative code editor with a shared terminal,
              live editing, and seamless integration. Start coding together,
              instantly.
            </p>

            <div className="hero-cta">
              <Link to={isAuthenticated ? "/code-editor/solo" : "/login"}>
                <button className="hero-cta-button">Code Solo</button>
              </Link>
              <button
                className="hero-cta-button"
                onClick={() => handleOpenModal("join")}
              >
                Join Room
              </button>
              <button
                className="hero-cta-button"
                onClick={() => handleOpenModal("create")}
              >
                Create Room
              </button>
            </div>
          </div>
        </section>

        <section id="features" className="features-section">
          <div className="container">
            <h2 className="section-title">Why Choose CodeTogether?</h2>
            <div className="features-grid">
              <div className="feature-card">
                <FaUsers className="feature-icon" />
                <h3>Real-Time Collaboration</h3>
                <p>
                  See changes as they happen. Multiple cursors, synchronized
                  editing, and live feedback make pair programming a breeze.
                </p>
              </div>
              <div className="feature-card">
                <FaCodeBranch className="feature-icon" />
                <h3>Multi-Language Support</h3>
                <p>
                  From JavaScript to Python, C++ to Go, enjoy syntax
                  highlighting and intelligent code completion for your favorite
                  languages.
                </p>
              </div>
              <div className="feature-card">
                <FaTerminal className="feature-icon" />
                <h3>Integrated Shared Terminal</h3>
                <p>
                  Execute commands, run tests, and manage servers together in
                  one shared terminal. No more screen sharing lag.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="how-it-works-section">
          <div className="container">
            <h2 className="section-title">Get Started in Seconds</h2>
            <div className="steps-container">
              <div className="step">
                <div className="step-number">1</div>
                <h3>Create a Room</h3>
                <p>
                  Start a new session with a single click. No sign-up required
                  to get started.
                </p>
              </div>
              <div className="step-arrow">→</div>
              <div className="step">
                <div className="step-number">2</div>
                <h3>Share the Link</h3>
                <p>
                  Invite your team by sending them a unique, secure link to your
                  session.
                </p>
              </div>
              <div className="step-arrow">→</div>
              <div className="step">
                <div className="step-number">3</div>
                <h3>Code Together</h3>
                <p>
                  Enjoy a seamless collaborative coding experience in your
                  shared environment.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default Home;
