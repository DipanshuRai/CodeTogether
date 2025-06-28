import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider.jsx";
import { ChakraProvider } from "@chakra-ui/react";
import theme from "./theme.js";
import { SocketProvider } from "./context/socket.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  // <React.StrictMode>
    <BrowserRouter>
      <ChakraProvider theme={theme}>
        <AuthProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </AuthProvider>
      </ChakraProvider>
    </BrowserRouter>
  // {/* </React.StrictMode> */}
);
