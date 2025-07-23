import { useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { WebsocketProvider } from 'y-websocket';
import { CODE_SNIPPETS } from '../utils/constants';
import debounce from 'lodash/debounce';

const YJS_WEBSOCKET_URL = import.meta.env.VITE_YJS_WEBSOCKET_URL || 'ws://localhost:1234';

export const useYjs = ({ roomId, editorRef, onLanguageChange, enabled = true }) => {
    const providerRef = useRef(null);
    const yDocRef = useRef(null);
    const monacoBindingRef = useRef(null);
    const isInitializedRef = useRef(false);

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
        if (!enabled || !editorRef.current || isInitializedRef.current) {
            return;
        }

        let cleanup = () => {};

        const initialize = () => {
            if (isInitializedRef.current || !editorRef.current?.getModel()) return;

            isInitializedRef.current = true;

            const yDoc = new Y.Doc();
            yDocRef.current = yDoc;

            const provider = new WebsocketProvider(YJS_WEBSOCKET_URL, roomId, yDoc);
            providerRef.current = provider;

            const yText = yDoc.getText("monaco");
            const yMetadata = yDoc.getMap("metadata");

            monacoBindingRef.current = new MonacoBinding(
                yText,
                editorRef.current.getModel(),
                new Set([editorRef.current]),
                provider.awareness 
            );

            const onMetadataChange = (event) => {
                if (event.keysChanged.has('language')) {
                    const newLanguage = yMetadata.get('language');
                    if (newLanguage && typeof onLanguageChange === 'function') {
                        onLanguageChange(newLanguage);
                    }
                }
            };

            yMetadata.observe(onMetadataChange);

            const debouncedLog = debounce((code) => {
                console.log('Final editor content:', code);
            }, 200);

            editorRef.current?.onDidChangeModelContent(() => {
                debouncedLog(editorRef.current.getValue());
            });

            yText.observe(() => {
                console.log('Shared document state:', yText.toString());
            });

            provider.on('sync', (isSynced) => {
                if (isSynced && yText.length === 0) {
                    const initialLanguage = 'cpp';
                    const initialCode = CODE_SNIPPETS[initialLanguage] || "";
                    yDoc.transact(() => {
                        yText.insert(0, initialCode);
                        yMetadata.set('language', initialLanguage);
                    });
                }
            });

            cleanup = () => {
                yMetadata.unobserve(onMetadataChange);
                provider.disconnect();
                if (monacoBindingRef.current) {
                    monacoBindingRef.current.destroy();
                }
                yDoc.destroy();
                isInitializedRef.current = false;
            };
        };

        // Delay initialization to ensure the editor is fully mounted
        const timer = setTimeout(initialize, 100);

        return () => {
            clearTimeout(timer);
            cleanup();
        };

    }, [enabled, roomId, editorRef, onLanguageChange]);

    return { updateCollabLanguage };
};