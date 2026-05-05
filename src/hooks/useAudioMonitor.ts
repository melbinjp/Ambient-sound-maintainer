import { useState, useRef, useEffect, useCallback } from 'react';

export type Recording = {
  id: string;
  url: string;
  timestamp: Date;
};

export function useAudioMonitor() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [volume, setVolume] = useState(0);       // Estimated dB SPL
  const [threshold, setThreshold] = useState(70); // dB SPL Trigger
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'monitoring' | 'calibrating' | 'recording'>('idle');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const reqAnimationFrameRef = useRef<number | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const isRecordingRef = useRef(false);
  const lastExceededRef = useRef<number>(0);
  const chunksRef = useRef<BlobPart[]>([]);

  const alertOscRef = useRef<OscillatorNode | null>(null);
  const alertLfoRef = useRef<OscillatorNode | null>(null);
  const alertGainRef = useRef<GainNode | null>(null);
  const isAlertingRef = useRef(false);

  const thresholdRef = useRef(threshold);
  const isAutoModeRef = useRef(isAutoMode);
  const isCalibratingRef = useRef(isCalibrating);
  const currentVolumeRef = useRef(0);

  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);
  useEffect(() => { isAutoModeRef.current = isAutoMode; }, [isAutoMode]);
  useEffect(() => {
    isCalibratingRef.current = isCalibrating;
    if (isMonitoring) {
      setStatus(isCalibrating ? 'calibrating' : (isRecordingRef.current ? 'recording' : 'monitoring'));
    } else {
      setStatus('idle');
    }
  }, [isCalibrating, isMonitoring]);

  const cleanup = useCallback(() => {
    if (reqAnimationFrameRef.current) cancelAnimationFrame(reqAnimationFrameRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (alertOscRef.current) try { alertOscRef.current.stop(); } catch(e){}
    if (alertLfoRef.current) try { alertLfoRef.current.stop(); } catch(e){}

    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(console.error);
    }

    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    recorderRef.current = null;
    alertGainRef.current = null;
    isRecordingRef.current = false;
    isAlertingRef.current = false;
    setIsMonitoring(false);
    setIsCalibrating(false);
    setStatus('idle');
    setVolume(0);
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = () => {
      if (!streamRef.current || isRecordingRef.current) return;
      try {
          isRecordingRef.current = true;
          setStatus('recording');
          const recorder = new MediaRecorder(streamRef.current);
          recorderRef.current = recorder;
          chunksRef.current = [];

          recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunksRef.current.push(e.data);
          };

          recorder.onstop = () => {
              if (chunksRef.current.length > 0) {
                  const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                  const url = URL.createObjectURL(blob);
                  setRecordings(prev => [{
                      id: Math.random().toString(36).substring(7),
                      url,
                      timestamp: new Date()
                  }, ...prev]);
              }
          };
          
          recorder.start();
      } catch(e) {
          console.error("Recording start failed", e);
          isRecordingRef.current = false;
      }
  };

  const stopRecording = () => {
      if (!isRecordingRef.current) return;
      isRecordingRef.current = false;
      setStatus(isCalibratingRef.current ? 'calibrating' : 'monitoring');
      if (recorderRef.current && recorderRef.current.state === 'recording') {
          recorderRef.current.stop();
      }
  };

  const triggerCalibration = useCallback(() => {
      setIsCalibrating(true);
      const startTime = Date.now();
      let samples: number[] = [];

      const collect = () => {
           samples.push(currentVolumeRef.current);
           if (Date.now() - startTime < 4000) {
                setTimeout(collect, 100);
           } else {
                const avg = samples.reduce((sum, v) => sum + v, 0) / Math.max(1, samples.length);
                let calculated = Math.round(avg + 20);
                calculated = Math.max(65, Math.min(calculated, 85));
                setThreshold(calculated);
                setIsCalibrating(false);
           }
      };
      setTimeout(collect, 500); 
  }, []);

  const monitorLoop = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(dataArray);

    let sumSquares = 0.0;
    for (let i = 0; i < dataArray.length; i++) {
        sumSquares += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);

    let dbSpl = 0;
    if (rms > 0.0001) {
        const dbFs = 20 * Math.log10(rms);
        dbSpl = Math.max(0, dbFs + 100);
    }

    currentVolumeRef.current = (currentVolumeRef.current * 0.85) + (dbSpl * 0.15);
    const displayDb = Math.round(currentVolumeRef.current);
    setVolume(displayDb);

    if (!isCalibratingRef.current) {
        if (displayDb > thresholdRef.current) {
            if (!isAlertingRef.current && alertGainRef.current && audioCtxRef.current) {
                isAlertingRef.current = true;
                alertGainRef.current.gain.setTargetAtTime(1, audioCtxRef.current.currentTime, 0.02);
            }
            lastExceededRef.current = Date.now();

            if (!isRecordingRef.current) {
                startRecording();
            }
        } else {
            if (isAlertingRef.current && alertGainRef.current && audioCtxRef.current) {
                isAlertingRef.current = false;
                alertGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.02);
            }

            if (isRecordingRef.current && Date.now() - lastExceededRef.current > 3000) {
                stopRecording();
            }
        }
    }

    reqAnimationFrameRef.current = requestAnimationFrame(monitorLoop);
  }, []);

  const manualRecalibrate = () => {
       if (isMonitoring && isAutoMode) {
            triggerCalibration();
       }
  };

  const startMonitoring = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true, 
          noiseSuppression: false, 
          autoGainControl: false, 
        }
      });

      streamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 800;

      const lfo = audioCtx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 6;

      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 400;

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      const alertGain = audioCtx.createGain();
      alertGain.gain.value = 0;

      osc.connect(alertGain);
      alertGain.connect(audioCtx.destination);
      
      osc.start();
      lfo.start();

      alertOscRef.current = osc;
      alertLfoRef.current = lfo;
      alertGainRef.current = alertGain;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2; 
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsMonitoring(true);

      if (isAutoModeRef.current) {
           triggerCalibration();
      } else {
           setStatus('monitoring');
      }

      if (reqAnimationFrameRef.current) cancelAnimationFrame(reqAnimationFrameRef.current);
      monitorLoop();

    } catch (err) {
      console.error("Microphone access error", err);
      setError("Microphone access is required to listen to ambient sound and cancel echoes.");
    }
  };

  const stopMonitoring = () => {
    cleanup();
  };

  const deleteRecording = (id: string) => {
      setRecordings(prev => {
          const newArray = prev.filter(r => r.id !== id);
          const toRemove = prev.find(r => r.id === id);
          if (toRemove) URL.revokeObjectURL(toRemove.url);
          return newArray;
      });
  }

  return {
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
  };
}
