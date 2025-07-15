import { createWorker } from "mediasoup";
// import { workers } from "mediasoup/node/lib/Worker";

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
];

const createMediasoupWorker = async () => {
  worker = await createWorker({
    logLevel: "warn",
  });

  worker.on("died", () => {
    console.error("mediasoup worker has died");
    setTimeout(() => process.exit(1), 2000); // exit in 2 seconds
  });

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