import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthProvider';

const BASE_URL=import.meta.env.VITE_API_BASE_URL;

export const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const {auth}=useAuth();

    useEffect(() => {
        if(!auth?.accessToken) return;

        const newSocket = io(BASE_URL, {
            transports: ['websocket'],
            withCredentials: true,
        });
        
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
            setSocket(null);
        };
    }, [auth?.accessToken]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
