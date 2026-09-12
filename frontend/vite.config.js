import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Manual chunking keeps the initial bundle small. Each heavy vendor
        // lives in its own file so Home only loads what it needs.
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return;
          if (id.includes("monaco-editor") || id.includes("@monaco-editor")) return "monaco";
          if (id.includes("mediasoup-client")) return "mediasoup";
          if (
            id.includes("@liveblocks") ||
            id.includes("y-monaco") ||
            id.includes("y-protocols") ||
            id.includes("y-webrtc") ||
            id.includes("y-websocket") ||
            id.includes("yjs")
          )
            return "liveblocks-yjs";
          if (id.includes("@tldraw") || id.includes("tldraw")) return "tldraw";
          if (id.includes("@chakra-ui") || id.includes("@emotion") || id.includes("framer-motion")) return "chakra";
          if (id.includes("react-icons") || id.includes("lucide-react") || id.includes("@fortawesome")) return "icons";
          if (id.includes("socket.io-client")) return "socketio";
          if (id.includes("react-router")) return "router";
          if (id.includes("react-hot-toast")) return "toast";
          if (id.includes("axios")) return "axios";
          return "vendor";
        },
      },
    },
  },
});
