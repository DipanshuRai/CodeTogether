import { useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { CODE_SNIPPETS } from '../utils/constants';

export const useYjs = ({ socket, roomId, editorRef, onLanguageChange, enabled = true }) => {
    const yDocRef = useRef(null);
    const monacoBindingRef = useRef(null);
    const isInitializedRef = useRef(false);

    // Function to change the language and code content for all users
    const updateCollabLanguage = useCallback((newLanguage) => {
        const yDoc = yDocRef.current;
        if (!yDoc || !enabled) return;

        try {
            const yText = yDoc.getText("monaco");
            const yMetadata = yDoc.getMap("metadata");

            const newCode = CODE_SNIPPETS[newLanguage] || "";
            
            yDoc.transact(() => {
                yText.delete(0, yText.length);
                yText.insert(0, newCode);
                
                yMetadata.set('language', newLanguage);
            });
        } catch (error) {
            console.error('Error updating collaborative language:', error);
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled || !socket || !editorRef.current || isInitializedRef.current) {
            return;
        }

        let isDestroyed = false;
        
        const initialize = () => {
            if (isInitializedRef.current || !editorRef.current?.getModel()) return;
            
            isInitializedRef.current = true;
            
            const yDoc = new Y.Doc();
            yDocRef.current = yDoc;

            const yText = yDoc.getText("monaco");
            const yMetadata = yDoc.getMap("metadata");

            monacoBindingRef.current = new MonacoBinding(
                yText,
                editorRef.current.getModel(),
                new Set([editorRef.current])
            );
                        
            // Send local document changes to the server
            const onDocUpdate = (update, origin) => {
                if (!isDestroyed && origin !== socket) {
                    socket.emit('crdt:update', roomId, update);
                }
            };

            // Apply remote document changes from the server
            const onRemoteDocUpdate = (update) => {
                if (!isDestroyed) {
                    Y.applyUpdate(yDoc, new Uint8Array(update), socket);
                }
            };
            
            // Listen for changes to the language in the shared metadata
            const onMetadataChange = (event) => {
                if (!isDestroyed && event.keysChanged.has('language')) {
                    const newLanguage = yMetadata.get('language');
                    
                    if (newLanguage && typeof onLanguageChange === 'function') {
                        onLanguageChange(newLanguage);
                    }
                }
            };

            // Bind handlers
            yDoc.on('update', onDocUpdate);
            socket.on('crdt:update', onRemoteDocUpdate);
            yMetadata.observe(onMetadataChange);

            socket.emit('crdt:get-state', roomId, (initialState) => {
                if (isDestroyed) return;
                
                if (initialState) {
                    Y.applyUpdate(yDoc, new Uint8Array(initialState));
                }

                if (yText.length === 0) {
                    const initialLanguage = 'cpp';
                    const initialCode = CODE_SNIPPETS[initialLanguage] || "";
                    yText.insert(0, initialCode);
                    yMetadata.set('language', initialLanguage);
                }
            });
            
            // Store cleanup function
            return () => {
                isDestroyed = true;
                
                yDoc.off('update', onDocUpdate);
                socket.off('crdt:update', onRemoteDocUpdate);
                yMetadata.unobserve(onMetadataChange);
                
                monacoBindingRef.current?.destroy();
                yDoc.destroy();
                
                isInitializedRef.current = false;
            };
        };

        let cleanup;

        const timer = setTimeout(() => {
            cleanup = initialize();
        }, 100);
        
        return () => {
            clearTimeout(timer);
            if(cleanup) cleanup();
        };

    }, [enabled, socket, roomId, editorRef, onLanguageChange]);

    return { updateCollabLanguage };
};