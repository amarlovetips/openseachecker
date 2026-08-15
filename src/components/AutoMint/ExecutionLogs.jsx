import React from 'react';
import { Terminal, Trash2, ExternalLink, Copy, Check } from 'lucide-react';

export default function ExecutionLogs({ logs = [], onClearLogs, selectedChain }) {
  const [copiedId, setCopiedId] = React.useState(null);

  const handleCopyHash = (hash, id) => {
    navigator.clipboard.writeText(hash);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden font-mono">
      
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          <Terminal size={15} className="text-cyan-400" />
          <span>Real-Time Execution Logs & RPC Block Stream</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
            {logs.length} events
          </span>
        </div>

        <button
          onClick={onClearLogs}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
          title="Clear Logs"
        >
          <Trash2 size={12} />
          <span>Clear</span>
        </button>
      </div>

      {/* Terminal Logs List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[350px] text-xs font-mono">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-600 space-y-2">
            <Terminal size={32} className="opacity-40" />
            <p>Ready to mint. Execution output will stream here in real-time...</p>
          </div>
        ) : (
          logs.map((log) => {
            let textColor = 'text-slate-300';
            let bgStyle = 'bg-slate-900/40 border-slate-800/60';

            if (log.type === 'success') {
              textColor = 'text-emerald-400';
              bgStyle = 'bg-emerald-950/20 border-emerald-800/40';
            } else if (log.type === 'error') {
              textColor = 'text-rose-400';
              bgStyle = 'bg-rose-950/20 border-rose-800/40';
            } else if (log.type === 'warning') {
              textColor = 'text-amber-300';
              bgStyle = 'bg-amber-950/20 border-amber-800/40';
            } else if (log.type === 'tx') {
              textColor = 'text-cyan-300 font-bold';
              bgStyle = 'bg-cyan-950/30 border-cyan-700/50 shadow-sm shadow-cyan-950/30';
            }

            return (
              <div
                key={log.id}
                className={`p-2.5 rounded-lg border ${bgStyle} transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2`}
              >
                <div className="flex items-start sm:items-center gap-2 overflow-hidden">
                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">[{log.timestamp}]</span>
                  <span className={`${textColor} break-all`}>{log.message}</span>
                </div>

                {log.details && log.details.hash && (
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                      {log.details.hash.slice(0, 8)}...{log.details.hash.slice(-6)}
                    </span>
                    
                    <button
                      onClick={() => handleCopyHash(log.details.hash, log.id)}
                      className="p-1 text-slate-400 hover:text-white rounded bg-slate-900 hover:bg-slate-800 border border-slate-800"
                      title="Copy Tx Hash"
                    >
                      {copiedId === log.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>

                    <a
                      href={`${selectedChain.explorerUrl}/tx/${log.details.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-400 hover:text-cyan-300 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800"
                      title="View on Explorer"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
