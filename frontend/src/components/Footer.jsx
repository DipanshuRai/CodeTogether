import './Footer.css';
import { FaGithub, FaTwitter, FaLinkedin } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-socials">
          <a href="https://github.com/DipanshuRai" target="_blank" rel="noopener noreferrer" className="social-icon">
            <FaGithub />
          </a>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-icon">
            <FaTwitter />
          </a>
          <a href="https://www.linkedin.com/in/dipanshu-rai-1b913025b" target="_blank" rel="noopener noreferrer" className="social-icon">
            <FaLinkedin />
          </a>
        </div>
        <p className="footer-copyright">
          © {new Date().getFullYear()} CodeTogether. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;