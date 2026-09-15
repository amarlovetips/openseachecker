import React, { useState, useEffect } from 'react';
import { OpenSeaService } from '../../services/openSea';
import { autoMintEngine } from '../../services/autoMint';
import { StorageService } from '../../services/storage';
import { backgroundTimerService } from '../../services/backgroundWorker';
import { getChainById } from '../../constants/chains';
import CountdownTimer from './CountdownTimer';
import ExecutionLogs from './ExecutionLogs';
import { Rocket, Search, Sparkles, AlertCircle, ShieldCheck, Zap, Square, Clock, BellRing, CheckCircle2, Layers, Flame, Calendar, Info, Users, Check, Gauge, Cpu } from 'lucide-react';

export default function MintAnalyzer({ selectedChain, onSelectChain, wallets = [], onOpenSettings }) {
  const [inputUrl, setInputUrl] = useState('');
  const [dropInfo, setDropInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [targetQty, setTargetQty] = useState(1);
  const [activeWalletCount, setActiveWalletCount] = useState(null);
  const [executionMode, setExecutionMode] = useState('parallel'); // 'parallel' or 'sequential'
  const [latencyOffsetMs, setLatencyOffsetMs] = useState(15);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [customDateTime, setCustomDateTime] = useState('');
  const [botState, setBotState] = useState({ isRunning: false, isArmed: false, isPreSigned: false, isPreStaging: false, logs: [] });

  useEffect(() => {
    // 1. Load persistent URL & Target Qty & Active Wallets Count from storage
    const savedUrl = StorageService.getLastUrl();
    const savedQty = StorageService.getTargetQty();
    const savedWalletsCount = StorageService.getActiveWalletsCount();
    const savedMode = StorageService.getExecutionMode();
    const savedOffset = StorageService.getLatencyOffset();

    if (savedQty) setTargetQty(savedQty);
    if (savedWalletsCount !== null) setActiveWalletCount(savedWalletsCount);
    if (savedMode) setExecutionMode(savedMode);
    if (savedOffset !== null) setLatencyOffsetMs(savedOffset);

    if (savedUrl) {
      setInputUrl(savedUrl);
      handleAnalyze(savedUrl);
    }

    // 2. Subscribe to autoMintEngine
    const unsubscribe = autoMintEngine.subscribe((state) => {
      setBotState(state);
    });

    return () => unsubscribe();
  }, [selectedChain]);

  // If activeWalletCount is not set or greater than wallets length, default to all wallets
  const effectiveWalletsToUse = () => {
    if (!wallets || wallets.length === 0) return [];
    if (!activeWalletCount || activeWalletCount <= 0 || activeWalletCount > wallets.length) {
      return wallets;
    }
    return wallets.slice(0, activeWalletCount);
  };

  const currentMintWallets = effectiveWalletsToUse();

  const handleAnalyze = async (queryToAnalyze) => {
    const query = queryToAnalyze !== undefined ? queryToAnalyze : inputUrl;
    if (!query || !query.trim()) {
      setErrorMsg("Please paste an OpenSea drop link or contract address.");
      return;
    }

    setErrorMsg('');
    setLoading(true);
    try {
      StorageService.saveLastUrl(query.trim());
      const result = await OpenSeaService.analyzeDrop(query.trim(), selectedChain.id);
      setDropInfo(result);

      // Auto-select detected chain and persist
      if (result.chainSlug && onSelectChain) {
        const detectedChainObj = getChainById(result.chainSlug);
        if (detectedChainObj && detectedChainObj.id !== selectedChain.id) {
          onSelectChain(detectedChainObj);
        }
      }

      // Default target stage: Public stage
      const pubStage = result.stages.find(s => s.isPublic) || result.stages[result.stages.length - 1];
      setSelectedStageId(pubStage.id);

      if (pubStage.startTime > 0) {
        const d = new Date(pubStage.startTime);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        setCustomDateTime(d.toISOString().slice(0, 16));
      } else {
        setCustomDateTime('');
      }
    } catch (err) {
      setErrorMsg(err.message || "Could not parse OpenSea link or contract.");
      setDropInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveTargetStage = () => {
    if (!dropInfo || !dropInfo.stages) return null;
    return dropInfo.stages.find(s => s.id === selectedStageId) || dropInfo.publicStage || dropInfo.stages[dropInfo.stages.length - 1];
  };

  const targetStage = getEffectiveTargetStage();
  const effectiveStartTime = customDateTime ? new Date(customDateTime).getTime() : (targetStage?.startTime || dropInfo?.startTime || 0);
  const isTargetStageLive = effectiveStartTime > 0 ? (Date.now() >= effectiveStartTime && (targetStage?.endTime ? Date.now() <= targetStage.endTime : true)) : targetStage?.status === 'LIVE';

  const handleArmBot = () => {
    if (currentMintWallets.length === 0) {
      alert("No wallets configured! Please go to Settings tab to enter your Secret Recovery Phrase or Private Keys.");
      if (onOpenSettings) onOpenSettings();
      return;
    }

    if (!dropInfo || !targetStage) return;

    backgroundTimerService.requestNotificationPermission();

    const targetDropInfo = {
      ...dropInfo,
      startTime: effectiveStartTime,
      mintPrice: targetStage.price,
      maxPerWallet: targetStage.maxPerWallet,
      targetStageName: targetStage.name,
    };

    autoMintEngine.armAutoMint({
      dropInfo: targetDropInfo,
      wallets: currentMintWallets,
      targetQuantityPerWallet: targetQty,
      chainInput: selectedChain,
      executionMode,
      latencyOffsetMs,
    });
  };

  const handleForceMintNow = () => {
    if (currentMintWallets.length === 0) {
      alert("No wallets configured! Please go to Settings tab to enter your Secret Recovery Phrase or Private Keys.");
      if (onOpenSettings) onOpenSettings();
      return;
    }
    if (!dropInfo || !targetStage) return;

    const targetDropInfo = {
      ...dropInfo,
      startTime: Date.now(),
      mintPrice: targetStage.price,
      maxPerWallet: targetStage.maxPerWallet,
      targetStageName: targetStage.name,
    };

    autoMintEngine.forceStartNow({
      dropInfo: targetDropInfo,
      wallets: currentMintWallets,
      targetQuantityPerWallet: targetQty,
      chainInput: selectedChain,
      executionMode,
    });
  };

  const handleStopBot = () => {
    autoMintEngine.stop();
  };

  const setQuickOffsetMins = (mins) => {
    const d = new Date(Date.now() + mins * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setCustomDateTime(d.toISOString().slice(0, 16));
  };

  const handleSetWalletCount = (num) => {
    const parsed = Math.max(1, Math.min(wallets.length || 1, parseInt(num, 10) || 1));
    setActiveWalletCount(parsed);
    StorageService.saveActiveWalletsCount(parsed);
  };

  const handleSetExecutionMode = (mode) => {
    setExecutionMode(mode);
    StorageService.saveExecutionMode(mode);
  };

  const handleSetLatencyOffset = (offset) => {
    setLatencyOffsetMs(offset);
    StorageService.saveLatencyOffset(offset);
  };

  const currentActiveStage = dropInfo?.currentStage || (dropInfo?.stages && dropInfo.stages.find(s => s.status === 'LIVE')) || dropInfo?.stages?.[0];

  return (
    <div className="space-y-6">
      
      {/* Top Search Bar */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles size={20} className="text-cyan-400" />
              OpenSea Nanosecond Turbo Auto-Mint Bot
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Auto-detects blockchain network, pre-signs transactions in memory, and triggers in nanoseconds across all wallets at T=0.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold flex items-center gap-1.5">
              <ShieldCheck size={14} /> {currentMintWallets.length} of {wallets.length} Wallets Selected
            </span>
          </div>
        </div>

        {/* Input Bar */}
        <form onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Paste OpenSea Drop Link (e.g. https://opensea.io/collection/laughingsighfox/overview)..."
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                StorageService.saveLastUrl(e.target.value);
              }}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500 transition-colors shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/50 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            {loading ? <span className="animate-spin">🌀</span> : <Rocket size={16} />}
            <span>Analyze Real Stages</span>
          </button>
        </form>

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

      </div>

      {/* Main Grid */}
      {dropInfo ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Drop Card */}
          <div className="lg:col-span-6 space-y-5">
            
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
              
              {/* Collection Header with Auto-Detected Chain Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {dropInfo.imageUrl ? (
                    <img
                      src={dropInfo.imageUrl}
                      alt={dropInfo.name}
                      className="h-14 w-14 rounded-xl object-cover border border-slate-700 shadow-md shrink-0"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                      NFT
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-white text-base">{dropInfo.name}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-slate-400 font-mono">
                        {dropInfo.contractAddress.slice(0, 8)}...{dropInfo.contractAddress.slice(-6)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold font-mono flex items-center gap-1">
                        <Check size={12} className="text-emerald-400" />
                        Auto-Detected: {dropInfo.chainName || selectedChain.name} ({dropInfo.symbol || selectedChain.symbol})
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                  isTargetStageLive
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500 animate-pulse'
                    : 'bg-indigo-950 text-cyan-300 border border-cyan-700'
                }`}>
                  {isTargetStageLive ? `🟢 ${targetStage?.name} LIVE` : `⏳ ${targetStage?.name} UPCOMING`}
                </div>
              </div>

              {/* Description */}
              {dropInfo.description && (
                <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {dropInfo.description}
                </p>
              )}

              {/* Current Active Mint Stage Notification Banner */}
              <div className="p-3.5 rounded-xl border bg-amber-950/40 border-amber-500/50 text-amber-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Flame size={18} className="text-amber-400 animate-pulse" />
                  <span>
                    CURRENT STAGE: <strong className="text-white uppercase">{currentActiveStage?.name || 'Stage 1'}</strong>
                  </span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  currentActiveStage?.status === 'LIVE' ? 'bg-emerald-900 text-emerald-200 border border-emerald-700' : 'bg-slate-900 text-slate-300 border border-slate-800'
                }`}>
                  STATUS: {currentActiveStage?.status || 'ACTIVE'}
                </span>
              </div>

              {/* Dedicated Target Stage Countdown Component */}
              <CountdownTimer
                targetTimestamp={effectiveStartTime}
                isLive={isTargetStageLive}
                stageTitle={`${targetStage?.name || 'Public'} Stage`}
              />

              {/* Scheduled Launch Time Controller */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Calendar size={14} className="text-cyan-400" /> Target Launch Date & Time:
                  </label>
                  <input
                    type="datetime-local"
                    value={customDateTime}
                    onChange={(e) => setCustomDateTime(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 text-xs font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (targetStage?.startTime > 0) {
                        const d = new Date(targetStage.startTime);
                        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                        setCustomDateTime(d.toISOString().slice(0, 16));
                      }
                    }}
                    className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-[10px] font-mono font-bold"
                  >
                    Reset to OpenSea Time
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickOffsetMins(2)}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-mono"
                  >
                    +2 Mins
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickOffsetMins(5)}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-mono"
                  >
                    +5 Mins
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickOffsetMins(15)}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-mono"
                  >
                    +15 Mins
                  </button>
                </div>
              </div>

              {/* Complete Real OpenSea Stages Pipeline */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5 text-white">
                    <Layers size={14} className="text-cyan-400" />
                    Authentic OpenSea Drop Stages ({dropInfo.stages?.length || 1} Stages)
                  </span>
                </div>

                <div className="space-y-2">
                  {dropInfo.stages?.map((stage, idx) => {
                    const isSelected = selectedStageId === stage.id;
                    const isLive = stage.status === 'LIVE';
                    const isUpcoming = stage.status === 'UPCOMING';
                    const isEnded = stage.status === 'ENDED';

                    return (
                      <div
                        key={stage.id || idx}
                        onClick={() => {
                          setSelectedStageId(stage.id);
                          if (stage.startTime > 0) {
                            const d = new Date(stage.startTime);
                            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                            setCustomDateTime(d.toISOString().slice(0, 16));
                          }
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-gradient-to-r from-cyan-950/70 to-slate-950 border-cyan-500 shadow-lg shadow-cyan-950/40'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600'
                          }`}>
                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-black" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white uppercase">{stage.name}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                isLive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : isUpcoming ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-900 text-slate-500 border border-slate-800'
                              }`}>
                                {stage.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5 flex-wrap">
                              <span>Price: <strong className="text-cyan-300">{stage.price} {stage.symbol || dropInfo.symbol}</strong></span>
                              <span>•</span>
                              <span>Max: <strong>{stage.maxPerWallet} / wallet</strong></span>
                              {stage.startTime > 0 && (
                                <>
                                  <span>•</span>
                                  <span>Starts: {new Date(stage.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-mono">
                          {isLive ? (
                            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-1 rounded-lg border border-emerald-800 animate-pulse">
                              LIVE NOW
                            </span>
                          ) : stage.isPublic ? (
                            <span className="text-[10px] text-cyan-300 font-bold bg-cyan-950 px-2 py-1 rounded-lg border border-cyan-800">
                              🎯 PUBLIC MINT
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                              {isEnded ? 'ENDED' : 'UPCOMING'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Wallet Selection & Manual Input Control */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Users size={14} className="text-cyan-400" />
                    How Many Wallets to Use for Mint:
                  </span>
                  
                  {/* Manual Number Input */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">Manual Input:</span>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max={wallets.length || 100}
                        value={currentMintWallets.length}
                        onChange={(e) => handleSetWalletCount(e.target.value)}
                        className="w-16 px-2 py-1 rounded-lg bg-slate-900 border border-cyan-500/80 text-cyan-300 font-mono text-xs font-bold text-center focus:outline-none focus:border-cyan-400 shadow-inner"
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-400">/ {wallets.length} Wallets</span>
                  </div>
                </div>

                {/* Quick Wallet Count Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-900">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleSetWalletCount(1)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                      currentMintWallets.length === 1
                        ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-900/50'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    1 Wallet Only (Main)
                  </button>

                  {[2, 3, 5, 10, 20].filter(n => n <= wallets.length).map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handleSetWalletCount(count)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                        currentMintWallets.length === count
                          ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-900/50'
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {count} Wallets
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => handleSetWalletCount(wallets.length)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                      currentMintWallets.length === wallets.length
                        ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-900/50'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    All ({wallets.length}) Wallets
                  </button>
                </div>
              </div>

              {/* Nanosecond Execution Mode & Latency Compensation Controls */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-950 via-cyan-950/20 to-slate-950 border border-cyan-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Cpu size={15} className="text-cyan-400 animate-pulse" />
                    Firing Speed Strategy:
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold">
                    {executionMode === 'parallel' ? '⚡ NANOSECOND PARALLEL BLAST' : '⚡ 5MS SEQUENTIAL'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetExecutionMode('parallel')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      executionMode === 'parallel'
                        ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-lg shadow-cyan-950/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                      <Zap size={14} className="text-amber-400" />
                      <span>Nanosecond Blast</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Pre-signs all wallets. Blasts all transactions simultaneously in 0ms at T=0.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetExecutionMode('sequential')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      executionMode === 'sequential'
                        ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-lg shadow-cyan-950/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                      <Gauge size={14} className="text-cyan-400" />
                      <span>Sequential Cascade</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      5ms cascade. Checks on-chain supply availability before each wallet.
                    </p>
                  </button>
                </div>

                {/* Latency Lead Compensation */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-900/80 text-xs">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <Clock size={12} className="text-cyan-400" /> Network Pre-Fire Offset:
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { label: '0ms', val: 0 },
                      { label: '15ms (Fiber)', val: 15 },
                      { label: '50ms (Lead)', val: 50 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => handleSetLatencyOffset(opt.val)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                          latencyOffsetMs === opt.val
                            ? 'bg-cyan-600 text-white font-bold'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quantity Per Wallet */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-semibold text-slate-300">Target Mint / Wallet:</span>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 5, 10].map((qty) => (
                    <button
                      key={qty}
                      onClick={() => {
                        setTargetQty(qty);
                        StorageService.saveTargetQty(qty);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                        targetQty === qty
                          ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-900/50'
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {qty}
                    </button>
                  ))}
                </div>
              </div>

              {/* Armed Standby Status Banner with Nanosecond Cache Indicator */}
              {botState.isArmed && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/90 to-slate-900 border border-amber-500/80 text-amber-200 text-xs space-y-2 shadow-xl shadow-amber-950/50 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-amber-300">
                      <Clock size={16} />
                      <span>🛡️ BOT IS ARMED IN 0MS STANDBY MODE</span>
                    </div>
                    {botState.isPreSigned && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-extrabold flex items-center gap-1">
                        <Check size={12} /> RAM PRE-SIGNED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {botState.isPreSigned
                      ? `⚡ All ${currentMintWallets.length} transactions are pre-signed in memory. When countdown hits 0, it will blast all wallets simultaneously with nanosecond CPU speed!`
                      : `Pre-staging transactions in background memory for zero-latency nanosecond trigger...`}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {botState.isRunning ? (
                  <button
                    onClick={handleStopBot}
                    className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-xl shadow-rose-950/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Square size={18} className="fill-white" />
                    <span>STOP RUNNING AUTO-MINT BOT</span>
                  </button>
                ) : botState.isArmed ? (
                  <button
                    onClick={handleStopBot}
                    className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-xl shadow-amber-950/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Square size={18} />
                    <span>DISARM / CANCEL STANDBY MODE</span>
                  </button>
                ) : (
                  <button
                    onClick={handleArmBot}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 text-white font-extrabold text-sm shadow-xl shadow-cyan-950/60 transition-all flex items-center justify-center gap-2 tracking-wide uppercase"
                  >
                    <Zap size={18} className="text-amber-300 animate-bounce" />
                    <span>
                      {isTargetStageLive
                        ? `START 1MS AUTO-MINT NOW (${currentMintWallets.length} WALLET${currentMintWallets.length > 1 ? 'S' : ''})`
                        : `ARM NANOSECOND AUTO-MINT (${currentMintWallets.length} WALLETS)`}
                    </span>
                  </button>
                )}

                {/* Manual Trigger */}
                {!botState.isRunning && !botState.isArmed && !isTargetStageLive && (
                  <button
                    onClick={handleForceMintNow}
                    className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Zap size={13} className="text-amber-400" />
                    <span>Manual Force Mint Now (Skip Timer with {currentMintWallets.length} Wallets)</span>
                  </button>
                )}
              </div>

              {wallets.length === 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-950/50 border border-amber-800/60 text-amber-300 text-xs">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>No wallets active! Please go to Settings tab to enter your seed phrase or private keys.</span>
                </div>
              )}

            </div>
          </div>

          {/* Right Column: Real-Time Execution Stream */}
          <div className="lg:col-span-6">
            <ExecutionLogs
              logs={botState.logs}
              onClearLogs={() => autoMintEngine.clearLogs()}
              selectedChain={selectedChain}
            />
          </div>

        </div>
      ) : (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <Search size={40} className="mx-auto text-slate-600" />
          <h3 className="font-bold text-white text-base">Paste an OpenSea Link Above</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Paste any OpenSea drop link or contract address in the search input above to analyze all mint stages and arm auto-minting.
          </p>
        </div>
      )}

    </div>
  );
}
