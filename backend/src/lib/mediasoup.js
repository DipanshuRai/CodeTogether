import os from 'os';
import { createWorker } from 'mediasoup';

// Audio + multiple video codecs. The client picks via produce({codec}).
const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: { 'x-google-start-bitrate': 1000 },
  },
  {
    kind: 'video',
    mimeType: 'video/VP9',
    clockRate: 90000,
    parameters: { 'profile-id': 2, 'x-google-start-bitrate': 1000 },
  },
  {
    kind: 'video',
    mimeType: 'video/h264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '4d0032',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1000,
    },
  },
];

const detectLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
};

const ANNOUNCED_IP = process.env.ANNOUNCED_IP || detectLocalIp();
const LISTEN_IP = process.env.LISTEN_IP || '0.0.0.0';

// Optional ICE servers (TURN) from env. CSV of "urls|username|credential"
// e.g. TURN_SERVERS="turn:t1.example.com:3478?transport=udp|user|pass"
const parseIceServers = () => {
  const raw = process.env.TURN_SERVERS;
  if (!raw) return [];
  return raw.split(',').map(entry => {
    const [urls, username, credential] = entry.split('|').map(s => s?.trim());
    return username
      ? { urls, username, credential }
      : { urls };
  });
};

export const webRtcTransportOptions = {
  listenIps: [{ ip: LISTEN_IP, announcedIp: ANNOUNCED_IP }],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
  initialAvailableOutgoingBitrate: 1_000_000,
  iceServers: parseIceServers(),
};

// --- Worker pool ----------------------------------------------------------
// One mediasoup Worker per CPU core (capped). Routers are round-robined
// across workers so we use the box's full capacity instead of single-core.
const WORKER_COUNT = Math.max(
  1,
  Math.min(
    Number(process.env.MEDIASOUP_WORKERS) || os.cpus().length,
    os.cpus().length
  )
);
const workers = [];
let nextWorkerIdx = 0;

const startWorker = async () => {
  const w = await createWorker({
    logLevel: 'warn',
    rtcMinPort: Number(process.env.RTC_MIN_PORT) || 40000,
    rtcMaxPort: Number(process.env.RTC_MAX_PORT) || 49999,
  });
  w.on('died', () => {
    console.error(`mediasoup worker ${w.pid} died — restarting in 2s`);
    setTimeout(async () => {
      try {
        const idx = workers.indexOf(w);
        if (idx >= 0) workers[idx] = await startWorker();
      } catch (e) {
        console.error('failed to restart worker:', e);
      }
    }, 2000);
  });
  return w;
};

export const initializeWorkerPool = async () => {
  if (workers.length) return workers;
  console.log(
    `[mediasoup] booting ${WORKER_COUNT} worker(s) — announcedIp=${ANNOUNCED_IP}`
  );
  for (let i = 0; i < WORKER_COUNT; i++) {
    workers.push(await startWorker());
  }
  return workers;
};

const pickWorker = () => {
  const w = workers[nextWorkerIdx % workers.length];
  nextWorkerIdx++;
  return w;
};

export const createRouter = async () => {
  if (!workers.length) await initializeWorkerPool();
  const w = pickWorker();
  return w.createRouter({ mediaCodecs });
};

// Convenience: get worker stats (for /health endpoint).
export const getWorkerStats = async () => {
  return Promise.all(
    workers.map(async (w) => ({
      pid: w.pid,
      usage: await w.getResourceUsage().catch(() => null),
    }))
  );
};

// Graceful shutdown of all workers.
export const closeAllWorkers = () => {
  for (const w of workers) {
    try { w.close(); } catch { /* ignore */ }
  }
  workers.length = 0;
};
