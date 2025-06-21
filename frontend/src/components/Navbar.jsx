import { useState } from 'react';
import './Navbar.css';
import { FaCode, FaBars, FaTimes } from 'react-icons/fa';

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
        <ul className={isMenuOpen ? 'nav-menu active' : 'nav-menu'}>
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
          {/* Mobile-only Buttons Wrapper */}
          <li className="nav-item-mobile">
            <button className="nav-button btn-login">Login</button>
          </li>
          <li className="nav-item-mobile">
            <button className="nav-button btn-signup">Sign Up</button>
          </li>
        </ul>

        {/* Desktop-only Buttons */}
        <div className="nav-buttons-desktop">
          <button className="nav-button btn-login">Login</button>
          <button className="nav-button btn-signup">Sign Up</button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;