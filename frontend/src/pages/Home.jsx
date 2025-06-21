import { Link } from "react-router-dom";
import "./Home.css";
import { FaUsers, FaCodeBranch, FaTerminal } from "react-icons/fa";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";

const Home = () => {
  return (
    <>
      <Navbar />
      <main className="homepage">
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
              <button className="hero-cta-button">
                <Link to="/code-editor">Code Solo</Link>
              </button>
              <button className="hero-cta-button">Join Room</button>
              <button className="hero-cta-button">Create Room</button>
            </div>
          </div>
        </section>

        <section id="features" className="features-section">
          <div className="container">
            <h2 className="section-title">Why Choose CodeSync?</h2>
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
