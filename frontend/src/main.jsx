import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider.jsx";
import { ChakraProvider } from "@chakra-ui/react";
import theme from "./theme.js";
import { SocketProvider } from "./context/socket.jsx";
import { GoogleOAuthProvider } from '@react-oauth/google';

ReactDOM.createRoot(document.getElementById("root")).render(
  // <React.StrictMode>
    <BrowserRouter>
      <ChakraProvider theme={theme}>
        {/* <GoogleOAuthProvider clientId={import.meta.env.VITE_CLIENT_ID}> */}
        <GoogleOAuthProvider clientId="698625303632-pc6ebtugfsgssm4pfu0guk6b1h2qjnjr.apps.googleusercontent.com">
        <AuthProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </AuthProvider>
        </GoogleOAuthProvider>
      </ChakraProvider>
    </BrowserRouter>
  // {/* </React.StrictMode> */}
);
