import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Editor } from '@monaco-editor/react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import toast from 'react-hot-toast';
import { CODE_SNIPPETS } from '../utils/constants';
import { useAuth } from '../context/AuthProvider';
import { useSocket } from '../context/socket';
import { useMediasoup } from '../hooks/useMediasoup';
import { RoomProvider, useRoom, useStatus } from '@liveblocks/react';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import EditorHeader from '../components/EditorHeader';
import Input from '../components/Input';
import Output from '../components/Output';
import WhiteboardPane from '../components/WhiteboardPane';
import RoomView from '../components/RoomView';
import Modal from '../components/Alert';
import ChatPanel from '../components/ChatPanel';
import { ReactionsOverlay } from '../components/Reactions';
import NetworkStats from '../components/NetworkStats';
import './styles/CodeEditor.css';

// Bridge between Liveblocks Yjs + Monaco. Also surfaces awareness so cursor
// presence (name + color per peer) shows up in the editor automatically.
function LiveblocksManager({ editorRef, onLanguageChange, onStatusChange, setUpdateFn, fullName }) {
  const room = useRoom();
  const status = useStatus();
  const yjsRefsRef = useRef({ ytext: null, ymeta: null });

  useEffect(() => {
    onStatusChange(status !== 'connected');
  }, [status, onStatusChange]);

  const updateCollabLanguage = useCallback((newLanguage) => {
    const { ytext, ymeta } = yjsRefsRef.current;
    if (ytext && ymeta) {
      ytext.doc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, '');
        ymeta.set('language', newLanguage);
      });
    }
  }, []);

  useEffect(() => {
    setUpdateFn(() => updateCollabLanguage);
  }, [setUpdateFn, updateCollabLanguage]);

  useEffect(() => {
    if (status !== 'connected' || !editorRef.current) return undefined;

    let isDestroyed = false;
    const ydoc = new Y.Doc();
    const provider = new LiveblocksYjsProvider(room, ydoc);
    const ytext = ydoc.getText('monacoText');
    const ymeta = ydoc.getMap('monacoMetadata');
    yjsRefsRef.current = { ytext, ymeta };

    // Inject our name + a random pastel color into Yjs awareness so other
    // peers can render the cursor presence label.
    provider.awareness.setLocalStateField('user', {
      name: fullName || 'Anonymous',
      color: pastelColorFor(fullName || 'A'),
    });

    const binding = new MonacoBinding(
      ytext,
      editorRef.current.getModel(),
      new Set([editorRef.current]),
      provider.awareness
    );

    const handleMetaChange = () => {
      if (isDestroyed) return;
      const newLang = ymeta.get('language');
      if (newLang) onLanguageChange(newLang);
    };
    ymeta.observe(handleMetaChange);

    const onSync = () => {
      if (isDestroyed || !editorRef.current) return;
      const currentLang = ymeta.get('language');
      if (currentLang) onLanguageChange(currentLang);
    };
    provider.on('synced', onSync);

    return () => {
      isDestroyed = true;
      binding?.destroy();
      provider?.off('synced', onSync);
      provider?.destroy();
      yjsRefsRef.current = { ytext: null, ymeta: null };
    };
  }, [status, room, editorRef, onLanguageChange, fullName]);

  return null;
}

function pastelColorFor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 70%, 65%)`;
}

const CodeEditor = () => {
  const { auth } = useAuth();
  const socket = useSocket();
  const { roomId } = useParams();
  const { state } = useLocation();
  const action = state?.action || 'join';
  const isSolo = roomId === 'solo';

  const {
    myStream,
    screenStream,
    remoteStreams,
    users,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    toggleMedia,
    toggleScreenShare,
    activeSpeakerId,
    raisedHands,
    handRaised,
    messages,
    reactions,
    pinnedPeerId,
    sendChatMessage,
    toggleRaiseHand,
    sendReaction,
    togglePin,
    setConsumerPaused,
    getConsumerStats,
  } = useMediasoup(socket, roomId, auth.user.fullname, action);

  const editorRef = useRef(null);
  const [output, setOutput] = useState(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [activeView, setActiveView] = useState('io');
  const [isUsersPanelVisible, setIsUsersPanelVisible] = useState(true);
  const [isViewVisible, setIsViewVisible] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState(null);
  const [language, setLanguage] = useState('cpp');
  const [updateCollabLanguage, setUpdateCollabLanguage] = useState(() => () => {});
  const [isStorageLoading, setIsStorageLoading] = useState(true);

  // New UI state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsPeer, setStatsPeer] = useState(null);

  // Track unread chat count.
  const lastSeenMessagesRef = useRef(0);
  useEffect(() => {
    if (chatOpen) {
      lastSeenMessagesRef.current = messages.length;
      setChatUnread(0);
    } else {
      setChatUnread(Math.max(0, messages.length - lastSeenMessagesRef.current));
    }
  }, [messages, chatOpen]);

  const onLanguageChange = useCallback((newLanguage) => setLanguage(newLanguage), []);

  const handleLanguageSelect = useCallback((lang) => {
    if (isStorageLoading && !isSolo) return;
    if (lang === language) return;
    const editor = editorRef.current;
    const isEditorEmpty = !editor || editor.getValue().trim() === '';
    if (isEditorEmpty) {
      if (isSolo) setLanguage(lang);
      else updateCollabLanguage(lang, editor.getValue() || '');
    } else {
      setTargetLanguage(lang);
      setIsModalOpen(true);
    }
  }, [language, isSolo, updateCollabLanguage, isStorageLoading]);

  const handleConfirmChange = useCallback(() => {
    if (!targetLanguage) return;
    if (isSolo) setLanguage(targetLanguage);
    else updateCollabLanguage(targetLanguage, editorRef.current?.getValue() || '');
    setIsModalOpen(false);
    setTargetLanguage(null);
  }, [targetLanguage, isSolo, updateCollabLanguage]);

  const handleCancelChange = useCallback(() => {
    setIsModalOpen(false);
    setTargetLanguage(null);
  }, []);

  const toggleUsersPanel = useCallback(() => setIsUsersPanelVisible(p => !p), []);
  const handleToggleAudio = useCallback(() => toggleMedia('audio'), [toggleMedia]);
  const handleToggleVideo = useCallback(() => toggleMedia('video'), [toggleMedia]);

  useEffect(() => {
    if (activeView === 'whiteboard' || activeView === 'io') {
      setIsViewVisible(false);
      const timer = setTimeout(() => setIsViewVisible(true), 200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [activeView]);

  const onToggleStats = useCallback(() => {
    // Default to first remote peer if none picked.
    if (!statsPeer && users.length > 0) setStatsPeer(users[0].id);
    setStatsOpen(o => !o);
  }, [statsPeer, users]);

  const ioView = useMemo(() => (

    <Allotment vertical>
      <Allotment.Pane>
        <Input input={input} setInput={setInput} />
      </Allotment.Pane>
      <Allotment.Pane>
        <Output output={output} isLoading={isLoading} isError={isError} />
      </Allotment.Pane>
    </Allotment>
  ), [input, output, isLoading, isError]);

  const canvasView = useMemo(() => <WhiteboardPane />, []);

  // Map peer SocketId of pinned tile (RoomView uses peerId format).
  const pinnedSocketId = pinnedPeerId?.replace(/-screen$/, '') || null;

  const editorUI = (
    <div className="code-editor-layout">
      {!isSolo && (
        <LiveblocksManager
          editorRef={editorRef}
          onLanguageChange={onLanguageChange}
          onStatusChange={setIsStorageLoading}
          setUpdateFn={setUpdateCollabLanguage}
          fullName={auth?.user?.fullname}
        />
      )}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCancelChange}
        onConfirm={handleConfirmChange}
        title="Change Language?"
      >
        <p>
          {isSolo
            ? 'Changing the language will replace the current code with a default snippet. Are you sure?'
            : 'Changing the language will clear the editor for everyone in the room. Are you sure?'}
        </p>
      </Modal>

      <EditorHeader
        language={language}
        onSelect={handleLanguageSelect}
        editorRef={editorRef}
        setIsError={setIsError}
        setOutput={setOutput}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        onToggleUsers={toggleUsersPanel}
        input={input}
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        toggleAudio={handleToggleAudio}
        toggleVideo={handleToggleVideo}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={toggleScreenShare}
        activeView={activeView}
        onViewChange={setActiveView}
        isLanguageSelectorDisabled={!isSolo && isStorageLoading}
        // Room-only extras
        onToggleChat={!isSolo ? () => setChatOpen(o => !o) : undefined}
        chatUnread={chatUnread}
        onToggleRaiseHand={!isSolo ? toggleRaiseHand : undefined}
        handRaised={handRaised}
        onPickReaction={!isSolo ? sendReaction : undefined}
        onToggleStats={!isSolo ? onToggleStats : undefined}
      />

      <div className="content-wrapper">
        <main className="main-content">
          <Allotment>
            <Allotment.Pane preferredSize={700} minSize={400}>
              <Editor
                key={isSolo ? `solo-${language}` : 'collab-editor'}
                height="100%"
                theme="vs-dark"
                language={language}
                defaultValue={isSolo ? CODE_SNIPPETS[language] : ''}
                onMount={(editor) => {
                  editorRef.current = editor;
                  if (!isSolo && editor) editor.focus();
                }}
                options={{
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  padding: { top: 10, bottom: 10 },
                  formatOnPaste: true,
                  mouseWheelZoom: true,
                }}
              />
            </Allotment.Pane>
            <Allotment.Pane minSize={250}>
              <div className={`view-container ${isViewVisible ? 'visible' : ''}`}>
                {activeView === 'io' ? ioView : canvasView}
              </div>
            </Allotment.Pane>
          </Allotment>
        </main>
        <div className={`room-view-wrapper ${!isSolo && isUsersPanelVisible ? 'visible' : ''}`}>
          {!isSolo && (
            <RoomView
              myStream={myStream}
              screenStream={screenStream}
              remoteStreams={remoteStreams}
              users={users}
              isVideoEnabled={isVideoEnabled}
              auth={auth}
              activeSpeakerId={activeSpeakerId}
              raisedHands={raisedHands}
              pinnedPeerId={pinnedPeerId}
              onTogglePin={togglePin}
              onPeerVisibilityChange={setConsumerPaused}
              getConsumerStats={getConsumerStats}
            />
          )}
        </div>
      </div>

      {!isSolo && (
        <>
          <ChatPanel
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            messages={messages}
            onSend={sendChatMessage}
            selfSocketId={socket?.id}
          />
          <NetworkStats
            open={statsOpen}
            onClose={() => setStatsOpen(false)}
            peerId={statsPeer || pinnedSocketId}
            peerName={users.find(u => u.id === (statsPeer || pinnedSocketId))?.name}
            getConsumerStats={getConsumerStats}
          />
          <ReactionsOverlay reactions={reactions} />
        </>
      )}
    </div>
  );

  if (isSolo) return editorUI;

  return (
    <RoomProvider id={roomId} initialStorage={{}}>
      {editorUI}
    </RoomProvider>
  );
};

export default CodeEditor;
