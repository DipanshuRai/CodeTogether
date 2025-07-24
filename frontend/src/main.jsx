import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider.jsx";
import { LiveblocksProvider } from "@liveblocks/react";
import { SocketProvider } from "./context/socket.jsx";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { authenticateWithLiveblocks } from "./api/liveblocks.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <SocketProvider>
            <LiveblocksProvider authEndpoint={authenticateWithLiveblocks}>
              <App />
            </LiveblocksProvider>
          </SocketProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
