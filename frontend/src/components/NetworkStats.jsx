import { memo, useEffect, useState } from 'react';
import { FaWifi, FaTimes } from 'react-icons/fa';
import './styles/NetworkStats.css';

// Pulls stats from a single peer's video consumer once per 2s.
function useStats(peerId, getConsumerStats, open) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!open || !peerId || !getConsumerStats) return undefined;
    let cancelled = false;
    const tick = async () => {
      const stats = await getConsumerStats(peerId, 'video');
      if (!stats || cancelled) return;
      let inbound = null;
      let candidatePair = null;
      stats.forEach((r) => {
        if (r.type === 'inbound-rtp' && r.kind === 'video') inbound = r;
        if (r.type === 'candidate-pair' && (r.nominated || r.selected)) candidatePair = r;
      });
      setData({
        bytesReceived: inbound?.bytesReceived ?? 0,
        packetsReceived: inbound?.packetsReceived ?? 0,
        packetsLost: inbound?.packetsLost ?? 0,
        jitter: inbound?.jitter ?? 0,
        framesPerSecond: inbound?.framesPerSecond ?? 0,
        frameWidth: inbound?.frameWidth ?? 0,
        frameHeight: inbound?.frameHeight ?? 0,
        rtt: candidatePair?.currentRoundTripTime ?? 0,
      });
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(t); };
  }, [peerId, getConsumerStats, open]);
  return data;
}

const NetworkStats = memo(function NetworkStats({ open, onClose, peerId, peerName, getConsumerStats }) {
  const data = useStats(peerId, getConsumerStats, open);
  if (!open) return null;

  const lossRate = data && (data.packetsReceived + data.packetsLost) > 0
    ? ((data.packetsLost / (data.packetsLost + data.packetsReceived)) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="network-stats" role="dialog" aria-label="Network statistics">
      <header className="network-stats-header">
        <FaWifi />
        <span>Stats — {peerName ?? 'peer'}</span>
        <button className="network-stats-close" onClick={onClose} aria-label="Close stats">
          <FaTimes />
        </button>
      </header>
      <table className="network-stats-table">
        <tbody>
          <tr><th>Resolution</th><td>{data ? `${data.frameWidth}×${data.frameHeight}` : '—'}</td></tr>
          <tr><th>FPS</th><td>{data ? data.framesPerSecond?.toFixed(0) ?? '—' : '—'}</td></tr>
          <tr><th>RTT</th><td>{data ? `${(data.rtt * 1000).toFixed(0)} ms` : '—'}</td></tr>
          <tr><th>Jitter</th><td>{data ? `${(data.jitter * 1000).toFixed(0)} ms` : '—'}</td></tr>
          <tr><th>Packet loss</th><td>{lossRate}%</td></tr>
          <tr><th>Received</th><td>{data ? `${(data.bytesReceived / 1024).toFixed(1)} KB` : '—'}</td></tr>
        </tbody>
      </table>
    </div>
  );
});

export default NetworkStats;
