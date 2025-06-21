import React from 'react';
import LanguageSelector from './LanguageSelector';
import './EditorHeader.css';

const EditorHeader = ({ language, onSelect }) => {
  return (
    <div className="editor-header">
      <LanguageSelector language={language} onSelect={onSelect} />
      {/* You can add more controls here in the future, like a share button */}
    </div>
  );
};

export default EditorHeader;