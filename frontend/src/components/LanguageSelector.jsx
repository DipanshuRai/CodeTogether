import { LANGUAGE_VERSIONS } from "../constants";
import "./LanguageSelector.css";

const languages = Object.entries(LANGUAGE_VERSIONS);

const LanguageSelector = ({ onSelect, selectedLanguage }) => {
  return (
    <div className="language-selector">
      <label className="language-label">Language:</label>
      <select
        value={selectedLanguage}
        onChange={(e) => onSelect(e.target.value)}
      >
        {languages.map(([language, version]) => (
          <option key={language} value={language}>
            {language} ({version})
          </option>
        ))}
      </select>
    </div>
  );
};
export default LanguageSelector;
