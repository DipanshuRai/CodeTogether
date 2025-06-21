import { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import EditorHeader from '../components/EditorHeader';
import Output from '../components/Output';
import { CODE_SNIPPETS } from '../constants';
import { useSocket } from '../context/socket';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import './CodeEditor.css';

const CodeEditor = () => {
  const editorRef = useRef();
  const [language, setLanguage] = useState('javascript');
  const [value, setValue] = useState(CODE_SNIPPETS[language]);
  const socket = useSocket();

  const onSelect = (language) => {
    setLanguage(language);
    const snippet = CODE_SNIPPETS[language];
    setValue(snippet);

    if (socket) {
      socket.emit('code-change', { language: language, code: snippet });
    }
  };

  const onMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const handleCodeChange = (newValue) => {
    setValue(newValue);
    if (socket) {
      socket.emit('code-change', { language, code: newValue });
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleRemoteChange = ({ code, language }) => {
      setLanguage(language);
      setValue(code);
    };

    socket.on('remote-code-change', handleRemoteChange);

    return () => {
      socket.off('remote-code-change', handleRemoteChange);
    };
  }, [socket]);

  return (
    <div className="editor-container">
      <Allotment>
        <Allotment.Pane minSize={400}>
          <div className="editor-pane">
            <EditorHeader language={language} onSelect={onSelect} />
            <Editor
              className='editor'
              height="100vh"
              theme="vs-dark"
              language={language}
              defaultValue={CODE_SNIPPETS[language]}
              onMount={onMount}
              value={value}
              onChange={handleCodeChange}
            />
          </div>
        </Allotment.Pane>
        <Allotment.Pane>
          <div className="output-pane">
            <Output editorRef={editorRef} language={language} />
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
};

export default CodeEditor;