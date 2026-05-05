import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, Volume2, Mic, AlertTriangle, Trash2, Ear, RefreshCw } from 'lucide-react';
import { useAudioMonitor } from './hooks/useAudioMonitor';

export default function App() {
  const {
    isMonitoring,
    status,
    volume,
    threshold,
    setThreshold,
    startMonitoring,
    stopMonitoring,
    recordings,
    deleteRecording,
    error,
    isAutoMode,
    setIsAutoMode,
    manualRecalibrate
  } = useAudioMonitor();

  // Volume color relative to threshold
  const getVolumeColor = () => {
    if (volume >= threshold) return 'bg-rose-500';
    if (volume >= threshold * 0.85) return 'bg-yellow-400';
    return 'bg-emerald-500';
  };

  const isRecording = status === 'recording';
  const isCalibrating = status === 'calibrating';

  // Fixed SVG mapping to ensure volume maps cleanly to a 0-100 gauge visual scale,
  // assuming maximum measured SPL is around 100 dB SPL (though technically it can be 120, 100 is loud).
  const visualMax = 100;
  const dashVolume = Math.min(100, Math.max(0, (volume / visualMax) * 100));
  const dashThreshold = Math.min(100, Math.max(0, (threshold / visualMax) * 100));

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-rose-500/30">
      <div className="max-w-2xl mx-auto p-6 md:p-12 space-y-12">
        {/* Header */}
        <header className="space-y-4 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl mb-2 relative">
            <Ear className="w-8 h-8 text-rose-500" />
            {isRecording && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            QuietZone Manager
          </h1>
          <p className="text-neutral-400 max-w-sm mx-auto text-sm leading-relaxed">
            Instantly warns people when noise exceeds peaceful bounds, generating an alarm and recording evidence.
          </p>
        </header>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Main Monitor Display */}
        <div className="relative overflow-hidden rounded-3xl bg-neutral-900 border border-neutral-800 p-8 shadow-2xl">
          <AnimatePresence>
            {isRecording && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.1, 0.4, 0.1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="absolute inset-0 bg-rose-500/20 pointer-events-none"
                />
            )}
            {isCalibrating && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.05, 0.15, 0.05] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-blue-500/20 pointer-events-none"
                />
            )}
          </AnimatePresence>
          
          <div className="flex flex-col items-center gap-10 relative z-10">
            {/* Status Indicator */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {isMonitoring && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isRecording ? 'bg-rose-400' : isCalibrating ? 'bg-blue-400' : 'bg-emerald-400'
                  }`}></span>
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    !isMonitoring ? 'bg-neutral-600' : isRecording ? 'bg-rose-500' : isCalibrating ? 'bg-blue-500' : 'bg-emerald-500'
                }`}></span>
              </span>
              <span className="text-sm font-medium uppercase tracking-wider text-neutral-400">
                {!isMonitoring ? 'OFFLINE' : isCalibrating ? 'CALIBRATING BASELINE...' : isRecording ? 'EVIDENCE RECORDING' : 'MONITORING'}
              </span>
            </div>

            {/* Circular Volume Meter */}
            <div className="relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="48%"
                  fill="none"
                  stroke="#262626"
                  strokeWidth="8"
                  className="transition-all duration-300"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="48%"
                  fill="none"
                  stroke="#3f3f46"
                  strokeWidth="8"
                  strokeDasharray={`${dashThreshold} 100`}
                  pathLength="100"
                  className="transition-all duration-300"
                />
              </svg>

              <div className="absolute inset-5 rounded-full bg-neutral-950 flex flex-col items-center justify-center overflow-hidden">
                   <div className="absolute inset-0 flex flex-col justify-end">
                        <motion.div
                           className={`w-full transition-colors duration-100 ${getVolumeColor()}`}
                           animate={{ height: `${dashVolume}%` }}
                           transition={{ type: 'tween', duration: 0.1, ease: 'linear' }}
                        />
                   </div>
              </div>

              {/* Exact Value */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none drop-shadow-md">
                <span className="text-6xl md:text-7xl font-black tracking-tighter text-white">
                  {volume}
                </span>
                <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1">dB SPL</span>
              </div>
            </div>

            {/* Controls */}
            <div className="w-full space-y-8">
               <div className="bg-neutral-950 p-1.5 rounded-xl flex gap-1">
                  <button
                     onClick={() => setIsAutoMode(true)}
                     disabled={isMonitoring && isRecording}
                     className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                         isAutoMode 
                           ? 'bg-neutral-800 text-white shadow-sm' 
                           : 'text-neutral-500 hover:text-neutral-300 disabled:opacity-50'
                     }`}
                  >
                     Auto-Detect
                  </button>
                  <button
                     onClick={() => setIsAutoMode(false)}
                     disabled={isMonitoring && isRecording}
                     className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                         !isAutoMode 
                           ? 'bg-neutral-800 text-white shadow-sm' 
                           : 'text-neutral-500 hover:text-neutral-300 disabled:opacity-50'
                     }`}
                  >
                     Manual Range
                  </button>
               </div>

               <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm font-medium">
                     <span className="text-neutral-400 flex items-center gap-2">
                         <Volume2 className="w-4 h-4" /> Trigger Threshold
                     </span>
                     <div className="flex items-center gap-2">
                        {isAutoMode && isMonitoring && (
                             <button onClick={manualRecalibrate} className="text-xs flex items-center gap-1 bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-md hover:bg-neutral-700 transition" title="Recalibrate Background Noise">
                                 <RefreshCw className={`w-3 h-3 ${isCalibrating ? 'animate-spin' : ''}`} /> Calibrate
                             </button>
                        )}
                        <span className="text-white bg-neutral-800 px-3 py-1 rounded-md border border-neutral-700 font-mono">
                            {threshold} dB
                        </span>
                     </div>
                  </div>
                  <input 
                    type="range" 
                    min="40" 
                    max="100" 
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    disabled={isAutoMode || isRecording || isCalibrating} // Lock if auto bounds
                    className="w-full h-2.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white disabled:opacity-40"
                  />
                  {isAutoMode && (
                      <p className="text-xs text-neutral-500 text-center px-4">
                          Threshold is dynamically matched to background noise levels and bounded between 65-85 dB to isolate disruption.
                      </p>
                  )}
               </div>

               <div className="pt-4 flex justify-center">
                  {!isMonitoring ? (
                    <button
                      onClick={startMonitoring}
                      className="flex items-center gap-2 bg-white hover:bg-neutral-200 text-black px-8 py-4 rounded-full text-sm font-bold tracking-wide transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shadow-lg shadow-white/10"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      Start Guard
                    </button>
                  ) : (
                    <button
                      onClick={stopMonitoring}
                      className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-8 py-4 rounded-full text-sm font-bold tracking-wide transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shadow-lg shadow-rose-500/20"
                    >
                      <Square className="w-5 h-5 fill-current" />
                      Stop Guard
                    </button>
                  )}
               </div>
            </div>
          </div>
        </div>

        {/* Recordings List */}
        {recordings.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-rose-500" /> Evidence Logs
            </h2>
            <div className="grid gap-3">
              {recordings.map((recording) => (
                <div key={recording.id} className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group">
                  <div>
                    <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                      Loudness Event Recorded
                    </h3>
                    <p className="text-xs font-mono text-neutral-500 mt-1.5 ml-4">
                      {recording.timestamp.toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <audio 
                        src={recording.url} 
                        controls 
                        className="h-10 w-full md:w-64 grayscale invert opacity-70 hover:opacity-100 transition-opacity" 
                    />
                    <button 
                        onClick={() => deleteRecording(recording.id)}
                        className="p-2.5 rounded-xl bg-neutral-800/50 hover:bg-rose-500/20 hover:text-rose-400 text-neutral-500 transition-colors"
                        title="Delete recording"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
