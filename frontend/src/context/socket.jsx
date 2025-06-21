import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { BASE_URL } from '../constants';

const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const newSocket = io(BASE_URL, {
            withCredentials: true,
            transports: ['websocket'], // optional
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Socket connected to server');
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected from server');
        });

        newSocket.on('connect_error', (err) => {
            console.error('Connection error:', err.message);
        });

        return () => {
            console.log('Disconnecting socket...');
            newSocket.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
