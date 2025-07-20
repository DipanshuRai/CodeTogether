import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaCode, FaBars, FaTimes } from "react-icons/fa";
import { useAuth } from "../context/AuthProvider";
import { axiosPrivate } from "../api/axios";
import toast from "react-hot-toast";
import "./styles/Navbar.css";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { auth, setAuth } = useAuth();
  const navigate = useNavigate();
  const isAuthenticated = auth?.user ? true : false;

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = async () => {
    try {
      const res = await axiosPrivate.post("/api/auth/logout");
      setAuth({
        accessToken: null,
        user: null,
      });
      toast.success(res?.data?.message);
      navigate("/");
    } catch (error) {
      toast.error(error.response.data.message || "Logout failed");
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <FaCode className="navbar-icon" />
          <div className="navbar-title">
            <div className="name1">Code</div>
            <div className="name2">Together</div>
          </div>
        </Link>

        <div className="menu-icon" onClick={toggleMenu}>
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </div>

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

          {isAuthenticated ? (
            <li className="nav-item-mobile">
              <button onClick={handleLogout} className="nav-button btn-login">
                Logout
              </button>
            </li>
          ) : (
            <>
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
            </>
          )}
        </ul>

        <div className="nav-buttons-desktop">
          {isAuthenticated ? (
            <button onClick={handleLogout} className="nav-button btn-login">
              Logout
            </button>
          ) : (
            <>
              <Link to="/login">
                <button className="nav-button btn-login">Login</button>
              </Link>
              <Link to="/signup">
                <button className="nav-button btn-signup">Sign Up</button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
