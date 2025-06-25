import { useState } from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";
import { FaCode, FaBars, FaTimes } from "react-icons/fa";

const Navbar = () => {
  // State to manage the mobile menu's visibility
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Function to toggle the menu
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <a href="/" className="navbar-logo">
          <FaCode className="navbar-icon" />
          SynCode
        </a>

        {/* Hamburger Menu Icon */}
        <div className="menu-icon" onClick={toggleMenu}>
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </div>

        {/* Navigation Menu */}
        <ul className={isMenuOpen ? "nav-menu active" : "nav-menu"}>
          <li className="nav-item">
            <a href="#features" className="nav-links" onClick={toggleMenu}>
              Features
            </a>
          </li>
          <li className="nav-item">
            <a href="#how-it-works" className="nav-links" onClick={toggleMenu}>
              How it Works
            </a>
          </li>
          <li className="nav-item">
            <a href="/about" className="nav-links" onClick={toggleMenu}>
              About
            </a>
          </li>

          <li className="nav-item-mobile">
            <Link to="/login">
              <button className="nav-button btn-login">Login</button>
            </Link>
          </li>
          <li className="nav-item-mobile">
            <Link to="/signup">
              <button className="nav-button btn-signup">Sign Up</button>
            </Link>
          </li>
        </ul>

        <div className="nav-buttons-desktop">
          <button className="nav-button btn-login">
            <Link to="/login">Login</Link>
          </button>
          <Link to="/signup">
            <button className="nav-button btn-signup">Sign Up</button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
