import { useState, useEffect, useRef } from "react";
import { LANGUAGE_VERSIONS } from "../utils/constants";
import { LANGUAGE_ICONS, DEFAULT_ICON } from "../utils/languageIcons";
import { IoChevronDown } from "react-icons/io5";
import "./styles/LanguageSelector.css";

const languages = Object.entries(LANGUAGE_VERSIONS);

const LanguageSelector = ({ onSelect, selectedLanguage, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (language) => {
    onSelect(language);
    setIsOpen(false);
  };

  const SelectedIcon = LANGUAGE_ICONS[selectedLanguage] || DEFAULT_ICON;

  return (
    <div className={`language-selector-custom ${disabled ? 'disabled' : ''}`} ref={selectorRef}>
      <button
        className="selector-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title={disabled ? "Loading" : ""}
      >
        <div className="selected-option">
          <SelectedIcon className="selector-icon" />
          <span>{selectedLanguage}</span>
          <span>{LANGUAGE_VERSIONS[selectedLanguage]}</span>
        </div>
        <IoChevronDown className={`arrow-icon ${isOpen ? "open" : ""}`} />
      </button>

      {isOpen && (
        <ul className="selector-list">
          {languages.map(([language, version]) => {
            const ItemIcon = LANGUAGE_ICONS[language] || DEFAULT_ICON;
            return (
              <li
                key={language}
                className="selector-item"
                onClick={() => handleSelect(language)}
              >
                <ItemIcon className="selector-icon" />
                <span className="item-text">{language}</span>
                <span className="item-version">({version})</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LanguageSelector;