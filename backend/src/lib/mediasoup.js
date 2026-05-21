import os from "os";
import { createWorker } from "mediasoup";

let worker;

const mediaCodecs = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
  },
  {
    kind: "video",
    mimeType: "video/VP9",
    clockRate: 90000,
    parameters: {
      "profile-id": 2,
      "x-google-start-bitrate": 1000,
    },
  },
  {
    kind: "video",
    mimeType: "video/h264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "4d0032",
      "level-asymmetry-allowed": 1,
      "x-google-start-bitrate": 1000,
    },
  },
];

// Auto-detect a non-internal IPv4 address so WebRTC works across the LAN
// even if ANNOUNCED_IP is not set in .env.
const detectLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
};

const ANNOUNCED_IP = process.env.ANNOUNCED_IP || detectLocalIp();
const LISTEN_IP = process.env.LISTEN_IP || "0.0.0.0";

export const webRtcTransportOptions = {
  listenIps: [{ ip: LISTEN_IP, announcedIp: ANNOUNCED_IP }],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
  initialAvailableOutgoingBitrate: 1_000_000,
};

const createMediasoupWorker = async () => {
  worker = await createWorker({
    logLevel: "warn",
    rtcMinPort: Number(process.env.RTC_MIN_PORT) || 40000,
    rtcMaxPort: Number(process.env.RTC_MAX_PORT) || 49999,
  });

  worker.on("died", () => {
    console.error("mediasoup worker has died, exiting in 2s...");
    setTimeout(() => process.exit(1), 2000);
  });

  console.log(
    `mediasoup worker started (announcedIp=${ANNOUNCED_IP}, listenIp=${LISTEN_IP})`
  );
  return worker;
};

const createRouter = async () => {
  if (!worker) {
    worker = await createMediasoupWorker();
  }
  const router = await worker.createRouter({ mediaCodecs });
  return router;
};

export { createMediasoupWorker, createRouter };
