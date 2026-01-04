
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Eye, 
  Activity, 
  Clock, 
  Zap, 
  Play, 
  Square, 
  Loader2, 
  BrainCircuit, 
  Sparkles,
  EyeOff,
  Hand,
  Volume2,
  Smile,
  ChevronDown,
  Sun,
  Cpu,
  RefreshCcw,
  BarChart3,
  TrendingDown,
  Mic,
  Thermometer,
  AlertTriangle,
  ZapOff
} from 'lucide-react';
import { FaceLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, Cell, ComposedChart, Legend,
  ReferenceArea
} from 'recharts';
import { TrackingState, SessionStats, GazeDataPoint, AIAnalysis, SessionSnapshot } from './types';
import { StatsCard } from './components/StatsCard';
import { analyzeSession } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<TrackingState>(TrackingState.IDLE);
  const [showRetrospective, setShowRetrospective] = useState(false);
  
  // Real-time metrics for UI
  const [count, setCount] = useState(0);
  const [blinkCount, setBlinkCount] = useState(0);
  const [fidgetCount, setFidgetCount] = useState(0);
  const [thumpCount, setThumpCount] = useState(0);
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [headTilt, setHeadTilt] = useState(0);
  const [browFurrows, setBrowFurrows] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [systemStress, setSystemStress] = useState(0);
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [impactFlash, setImpactFlash] = useState(false);
  
  // Session tracking
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [gazeHistory, setGazeHistory] = useState<any[]>([]);
  const [fullSessionHistory, setFullSessionHistory] = useState<SessionSnapshot[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeVideoStream, setActiveVideoStream] = useState<MediaStream | null>(null);
  
  // AI State (Fixed missing variables)
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const lastFpsTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const lastSystemCheckTimeRef = useRef<number>(0);
  const lastSnapshotTimeRef = useRef<number>(0);
  const lastGazeHistoryTimeRef = useRef<number>(0);

  const countRef = useRef(0);
  const blinkCountRef = useRef(0);
  const fidgetCountRef = useRef(0);
  const thumpCountRef = useRef(0);
  const lastThumpTimeRef = useRef(0);
  const avgRmsRef = useRef(0.01); 
  const browFurrowsRef = useRef(0);
  const voiceSecondsRef = useRef(0);
  const lastLookingStateRef = useRef<boolean>(false);
  const isCurrentlyBlinkingRef = useRef<boolean>(false);
  const isHandInFrameRef = useRef<boolean>(false);
  const isBrowFurrowedRef = useRef<boolean>(false);
  const lastAudioTimeRef = useRef<number>(0);

  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
    canvasRef.current.width = 64;
    canvasRef.current.height = 48;
  }, []);

  useEffect(() => {
    const initModels = async () => {
      try {
        setState(TrackingState.LOADING);
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const [face, hand] = await Promise.all([
          FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, delegate: "GPU" },
            outputFaceBlendshapes: true,
            runningMode: "VIDEO",
            numFaces: 1,
          }),
          HandLandmarker.createFromOptions(filesetResolver, {
            baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" },
            runningMode: "VIDEO",
            numHands: 2,
          })
        ]);
        faceLandmarkerRef.current = face;
        handLandmarkerRef.current = hand;
        setState(TrackingState.IDLE);
      } catch (err) {
        console.error("Model Load Error:", err);
        setErrorMessage("Could not load AI models.");
        setState(TrackingState.ERROR);
      }
    };
    initModels();
  }, []);

  useEffect(() => {
    if (state === TrackingState.ACTIVE && activeVideoStream && videoRef.current) {
      videoRef.current.srcObject = activeVideoStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(console.error);
      };
    }
  }, [state, activeVideoStream]);

  const calculateStats = useCallback((): SessionStats => {
    const totalTime = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
    const lookingPoints = gazeHistory.filter(p => p.state === 1).length;
    const engagementScore = gazeHistory.length > 0 ? Math.round((lookingPoints / gazeHistory.length) * 100) : 0;
    return {
      totalLooks: countRef.current,
      totalTimeSeconds: totalTime,
      averageFocusDuration: totalTime > 0 ? Math.round(totalTime / Math.max(countRef.current, 1)) : 0,
      engagementScore,
      totalBlinks: blinkCountRef.current,
      handFidgetCount: fidgetCountRef.current,
      avgNoiseLevel: noiseLevel,
      voiceTimeSeconds: voiceSecondsRef.current,
      thumpCount: thumpCountRef.current,
      headTiltDegrees: headTilt,
      browFurrowCount: browFurrowsRef.current,
      avgBrightness: brightness,
      systemStressScore: systemStress,
      location: coords ? { latitude: coords.lat, longitude: coords.lng } : undefined
    };
  }, [sessionStartTime, gazeHistory, noiseLevel, headTilt, brightness, systemStress, coords]);

  const processEnvironmental = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const data = imageData.data;
    let totalLuminance = 0;
    for (let i = 0; i < data.length; i += 4) {
      totalLuminance += (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
    }
    setBrightness(totalLuminance / (data.length / 4));
  }, []);

  const processSystemStress = useCallback(() => {
    const now = performance.now();
    frameCountRef.current++;
    if (now - lastFpsTimeRef.current >= 1000) {
      const currentFps = (frameCountRef.current * 1000) / (now - lastFpsTimeRef.current);
      const fpsStress = Math.max(0, Math.min(100, (60 - currentFps) * 4));
      const perf = (performance as any).memory;
      let memStress = 0;
      if (perf && perf.usedJSHeapSize && perf.jsHeapLimit && perf.jsHeapLimit > 0) {
        memStress = (perf.usedJSHeapSize / perf.jsHeapLimit) * 100;
      }
      const combinedStress = (fpsStress * 0.8) + (memStress * 0.2);
      setSystemStress(isNaN(combinedStress) ? 0 : combinedStress);
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }
  }, []);

  const handleStartSession = async () => {
    try {
      const vStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = aStream;
      navigator.geolocation.getCurrentPosition(p => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }));
      setActiveVideoStream(vStream);
      countRef.current = 0; blinkCountRef.current = 0; fidgetCountRef.current = 0;
      thumpCountRef.current = 0; browFurrowsRef.current = 0; voiceSecondsRef.current = 0;
      lastThumpTimeRef.current = 0; avgRmsRef.current = 0.01;
      setCount(0); setBlinkCount(0); setFidgetCount(0); setThumpCount(0);
      setVoiceSeconds(0); setGazeHistory([]); setFullSessionHistory([]); setAiAnalysis(null);
      setSessionStartTime(Date.now());
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const src = ctx.createMediaStreamSource(aStream);
      const ana = ctx.createAnalyser();
      ana.fftSize = 2048; src.connect(ana);
      audioCtxRef.current = ctx; analyserRef.current = ana;
      lastAudioTimeRef.current = Date.now(); lastSnapshotTimeRef.current = Date.now(); lastGazeHistoryTimeRef.current = Date.now();
      setShowRetrospective(false);
      setState(TrackingState.ACTIVE);
    } catch (err) { 
      console.error("Session Start Error:", err);
      setErrorMessage("Media access required."); 
      setState(TrackingState.ERROR); 
    }
  };

  const handleStopSession = () => {
    if (activeVideoStream) activeVideoStream.getTracks().forEach(t => t.stop());
    audioStreamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setState(TrackingState.IDLE);
    setActiveVideoStream(null);
    setShowRetrospective(true);
    handleAnalyze(); 
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const currentStats = calculateStats();
      const analysis = await analyzeSession(currentStats);
      setAiAnalysis(analysis);
    } catch (err) { 
      console.error(err); 
      setErrorMessage("Diagnostic synthesis failed. Please retry.");
    } finally { 
      setIsAnalyzing(false); 
    }
  };

  const processAudio = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(data);
    let sum = 0; for (const amp of data) sum += amp * amp;
    const rms = Math.sqrt(sum / data.length);
    avgRmsRef.current = (avgRmsRef.current * 0.98) + (rms * 0.02);
    const db = 20 * Math.log10(rms || 0.00001);
    const currentNoise = (Math.max(0, Math.min(100, (db + 100) * 1.5)));
    setNoiseLevel(prev => (prev * 0.95) + (currentNoise * 0.05));
    const now = Date.now();
    const isSpike = rms > (avgRmsRef.current * 4) || rms > 0.08;
    if (isSpike && now - lastThumpTimeRef.current > 500) {
      thumpCountRef.current += 1;
      setThumpCount(thumpCountRef.current);
      lastThumpTimeRef.current = now;
      setImpactFlash(true);
      setTimeout(() => setImpactFlash(false), 200);
    }
    if (rms > 0.03 && now - lastAudioTimeRef.current > 1000) {
      voiceSecondsRef.current += 1;
      setVoiceSeconds(voiceSecondsRef.current);
      lastAudioTimeRef.current = now;
    }
  }, []);

  const detectMetrics = useCallback(() => {
    if (state === TrackingState.ACTIVE && videoRef.current && videoRef.current.readyState >= 2) {
      const now = Date.now();
      processAudio(); 
      processSystemStress();
      if (now - lastSystemCheckTimeRef.current > 1000) { 
        processEnvironmental(); 
        lastSystemCheckTimeRef.current = now; 
      }
      const face = faceLandmarkerRef.current?.detectForVideo(videoRef.current, now);
      let looking = false;
      if (face?.faceLandmarks?.length) {
        const landmarks = face.faceLandmarks[0];
        const hRatio = Math.abs(landmarks[1].x - landmarks[33].x) / Math.abs(landmarks[263].x - landmarks[33].x);
        looking = hRatio > 0.35 && hRatio < 0.65;
        if (looking && !lastLookingStateRef.current) {
          countRef.current += 1;
          setCount(countRef.current);
        }
        lastLookingStateRef.current = looking;
        const angle = Math.abs(Math.atan2(landmarks[263].y - landmarks[33].y, landmarks[263].x - landmarks[33].x) * (180 / Math.PI));
        setHeadTilt(angle);
        if (face.faceBlendshapes?.length) {
          const shapes = face.faceBlendshapes[0].categories;
          const blink = (shapes.find(c => c.categoryName === 'eyeBlinkLeft')?.score || 0) > 0.5 && (shapes.find(c => c.categoryName === 'eyeBlinkRight')?.score || 0) > 0.5;
          if (blink && !isCurrentlyBlinkingRef.current) {
            isCurrentlyBlinkingRef.current = true;
          } else if (!blink && isCurrentlyBlinkingRef.current) { 
            blinkCountRef.current += 1;
            setBlinkCount(blinkCountRef.current);
            isCurrentlyBlinkingRef.current = false; 
          }
          const furrowed = (shapes.find(c => c.categoryName === 'browDownLeft')?.score || 0) > 0.4 && (shapes.find(c => c.categoryName === 'browDownRight')?.score || 0) > 0.4;
          if (furrowed && !isBrowFurrowedRef.current) { 
            browFurrowsRef.current += 1;
            setBrowFurrows(browFurrowsRef.current);
            isBrowFurrowedRef.current = true; 
          } else if (!furrowed) {
            isBrowFurrowedRef.current = false;
          }
        }
      }
      setIsLooking(looking);
      if (now - lastGazeHistoryTimeRef.current > 100) {
        setGazeHistory(prev => [...prev.slice(-49), { time: now, state: looking ? 1 : 0 }]);
        lastGazeHistoryTimeRef.current = now;
      }
      const handsResult = handLandmarkerRef.current?.detectForVideo(videoRef.current, now);
      const handsInView = !!handsResult?.landmarks?.length;
      if (handsInView && !isHandInFrameRef.current) { 
        fidgetCountRef.current += 1;
        setFidgetCount(fidgetCountRef.current);
        isHandInFrameRef.current = true; 
      } else if (!handsInView) {
        isHandInFrameRef.current = false;
      }
      if (now - lastSnapshotTimeRef.current > 2000) {
        const stats = calculateStats();
        setFullSessionHistory(prev => [...prev, {
          timestamp: now,
          isLooking: looking,
          blinkCount: blinkCountRef.current,
          fidgetCount: fidgetCountRef.current,
          noiseLevel: noiseLevel,
          browFurrowCount: browFurrowsRef.current,
          brightness: brightness,
          systemStress: systemStress,
          thumpCount: thumpCountRef.current,
          headTilt: headTilt,
          focusScore: stats.engagementScore
        }]);
        lastSnapshotTimeRef.current = now;
      }
    }
    requestRef.current = requestAnimationFrame(detectMetrics);
  }, [state, noiseLevel, brightness, systemStress, headTilt, processAudio, processSystemStress, processEnvironmental, calculateStats]);

  useEffect(() => {
    if (state === TrackingState.ACTIVE) {
      requestRef.current = requestAnimationFrame(detectMetrics);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [state, detectMetrics]);

  const currentStats = calculateStats();

  const chartData = useMemo(() => {
    return fullSessionHistory.map((h, i) => {
      const prev = fullSessionHistory[i-1];
      const timeStr = `${Math.floor((h.timestamp - (sessionStartTime || 0))/1000)}s`;
      const isBlinking = prev ? (h.blinkCount > prev.blinkCount ? 1 : 0) : 0;
      const isFidgeting = prev ? (h.fidgetCount > prev.fidgetCount ? 1 : 0) : 0;
      const isImpact = prev ? (h.thumpCount > prev.thumpCount ? 1 : 0) : 0;
      
      return { 
        ...h, 
        timeStr, 
        isBlinking,
        isFidgeting,
        isImpact,
        hasEvent: isBlinking || isFidgeting || isImpact
      };
    });
  }, [fullSessionHistory, sessionStartTime]);

  const DiagnosticEngineCard = () => (
    <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-[40px] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden group w-full">
      <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 group-hover:scale-110 transition-transform pointer-events-none">
        <BrainCircuit size={160} />
      </div>
      <h3 className="text-3xl md:text-4xl font-black tracking-tighter">Diagnostic Engine</h3>
      <p className="text-indigo-100 mt-3 text-lg md:text-xl max-w-lg font-medium opacity-90 leading-relaxed">Gemini AI evaluates physical markers and hardware lag for optimization tips.</p>
      <div className="mt-10">
        {isAnalyzing ? (
          <div className="flex items-center gap-4 bg-white/10 w-fit px-8 py-4 rounded-3xl backdrop-blur-md border border-white/10">
            <Loader2 className="animate-spin text-indigo-300" size={24} />
            <span className="font-black text-lg">Synthesizing Forensics...</span>
          </div>
        ) : aiAnalysis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="bg-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-black text-2xl tracking-tighter">Live Verdict</h4>
                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${aiAnalysis.engagementLevel === 'High' ? 'bg-green-400 text-green-950' : 'bg-yellow-400 text-yellow-950'}`}>{aiAnalysis.engagementLevel} Engagement</span>
              </div>
              <p className="text-indigo-50 leading-relaxed italic text-xl font-medium">"{aiAnalysis.summary}"</p>
            </div>
            <div className="space-y-6">
              <h4 className="font-black text-2xl tracking-tighter">Tactical tips</h4>
              <div className="space-y-4">
                {aiAnalysis.tips.map((tip, i) => (
                  <div key={i} className="flex gap-5 items-center bg-white/5 p-4 md:p-5 rounded-2xl border border-white/10">
                    <span className="w-10 h-10 rounded-xl bg-indigo-500/50 flex items-center justify-center text-lg font-black border border-white/10 shrink-0">{i+1}</span>
                    <p className="text-sm font-bold leading-snug text-white/90">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <button 
            onClick={handleAnalyze} 
            className="bg-white text-indigo-600 px-10 py-5 rounded-3xl font-black hover:bg-indigo-50 transition-all shadow-2xl text-lg"
          >
            GENERATE BEHAVIORAL REPORT
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 selection:bg-indigo-100 bg-[#f8fafc]">
      <video ref={videoRef} muted playsInline className="hidden" />

      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Eye size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">FocusFlow</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Biometric Intelligence</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {state === TrackingState.ACTIVE ? (
              <button onClick={handleStopSession} className="flex items-center gap-2 bg-red-500 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200">
                <Square size={16} fill="white" /> Stop Session
              </button>
            ) : (
              <button 
                onClick={handleStartSession} 
                disabled={state === TrackingState.LOADING}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                {state === TrackingState.LOADING ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} fill="white" />}
                {showRetrospective ? 'New Session' : 'Start Tracking'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 text-red-700">
            <Zap size={20} className="text-red-500" />
            <span className="font-bold">{errorMessage}</span>
          </div>
        )}

        {!showRetrospective ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2.5">
                    <Activity size={20} className="text-indigo-500" /> Real-time Biometric Pulse
                  </h2>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${isLooking ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${isLooking ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                    {isLooking ? 'EYES ON SCREEN' : 'IDLE / AVERTED'}
                  </div>
                </div>
                <div className="p-8">
                  {state === TrackingState.ACTIVE ? (
                    <div className="space-y-8">
                      <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Engagement Timeline (Live 5s Window)</p>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /><span className="text-[10px] font-bold text-slate-500">Gaze Detected</span></div>
                          </div>
                        </div>
                        <div className="h-44 relative group">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={gazeHistory}>
                              <defs>
                                <linearGradient id="colorGaze" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis hide dataKey="time" />
                              <YAxis hide domain={[0, 1.2]} />
                              <Tooltip contentStyle={{ display: 'none' }} />
                              <Area
                                type="stepAfter"
                                dataKey="state"
                                stroke="#6366f1"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorGaze)"
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <StatsCard label="Attendance" value={count} icon={<Eye size={18}/>} color="blue" trend="Gaze Events" />
                        <StatsCard label="Blink Freq" value={blinkCount} icon={<EyeOff size={18}/>} color="green" trend="Eye Fatigue" />
                        <StatsCard label="Kinetic Jitter" value={fidgetCount} icon={<Hand size={18}/>} color="orange" trend="Fidgeting" />
                        
                        <div className={`transition-all duration-300 ${impactFlash ? 'scale-105 ring-4 ring-purple-400 rounded-xl' : ''}`}>
                          <StatsCard label="Impacts" value={thumpCount} icon={<Zap size={18}/>} color="purple" trend="Physical Peaks" />
                        </div>

                        <StatsCard label="Voice Activity" value={`${voiceSeconds}s`} icon={<Mic size={18}/>} color="blue" trend="Vocals" />
                        <StatsCard label="Noise Relative" value={`${Math.round(noiseLevel)}%`} icon={<Volume2 size={18}/>} color="orange" trend="Ambient" />
                        <StatsCard label="System Stress" value={`${Math.round(systemStress)}%`} icon={<Cpu size={18}/>} color="purple" trend="CPU Load" />
                        <StatsCard label="Env Light" value={`${Math.round(brightness)}`} icon={<Sun size={18}/>} color="blue" trend="Luminance" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-6">
                      <div className="w-24 h-24 rounded-[32px] bg-slate-100 flex items-center justify-center shadow-inner relative">
                        <Activity size={48} className="opacity-20 text-indigo-600" />
                      </div>
                      <div className="text-center">
                        <p className="font-black text-2xl text-slate-700">Telemetry Standby</p>
                        <p className="text-sm opacity-60 mt-2 max-w-sm mx-auto">Click Start Tracking to begin biometric analysis. Data remains private and processed locally.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {state === TrackingState.ACTIVE && (
                 <div className="bg-indigo-50 rounded-[32px] p-10 border border-indigo-100 relative overflow-hidden group">
                  <h4 className="font-black text-indigo-900 flex items-center gap-3 mb-4 uppercase text-[10px] tracking-[0.2em]"><Sparkles size={16}/> Privacy Standard</h4>
                  <p className="text-sm text-indigo-700 font-bold leading-relaxed opacity-80">FocusFlow uses local WASM models for computer vision. Your biometric data is temporary and never stored.</p>
                </div>
              )}
            </div>

            <div className="space-y-8">
              <div className="bg-white rounded-[32px] p-10 shadow-xl shadow-slate-200/40 border border-slate-100">
                <h3 className="font-black text-slate-800 flex items-center gap-3 mb-8 uppercase tracking-widest text-[10px]"><Clock size={16} className="text-indigo-500" /> Session Runtime</h3>
                <div className="space-y-8">
                  <div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-3">Time Running</p>
                    <p className="text-6xl font-black text-slate-900 tracking-tighter tabular-nums">
                      {Math.floor(currentStats.totalTimeSeconds / 60).toString().padStart(2, '0')}:
                      {(currentStats.totalTimeSeconds % 60).toString().padStart(2, '0')}
                    </p>
                  </div>
                  <div className="pt-8 border-t border-slate-100">
                    <div className="flex justify-between items-end mb-4">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Engagement Score</p>
                      <p className="text-3xl font-black text-indigo-600 tabular-nums">{currentStats.engagementScore}%</p>
                    </div>
                    <div className="h-5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-1000" style={{ width: `${currentStats.engagementScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Retrospective Forensic Report</h2>
                <p className="text-slate-500 font-bold text-xl mt-1">Multi-modal behavioral correlation.</p>
              </div>
              <button onClick={() => setShowRetrospective(false)} className="flex items-center gap-3 bg-slate-200 text-slate-800 px-8 py-4 rounded-[20px] font-black hover:bg-slate-300 transition-all shadow-sm">
                <RefreshCcw size={22} /> New Session
              </button>
            </div>

            <div className="w-full">
              <DiagnosticEngineCard />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard label="Net Engagement" value={`${currentStats.engagementScore}%`} icon={<TrendingDown size={20}/>} color="blue" trend="Focus Ratio" />
              <StatsCard label="Fatigue Events" value={currentStats.totalBlinks} icon={<EyeOff size={20}/>} color="green" trend="Total Blinks" />
              <StatsCard label="Kinetic Jitter" value={currentStats.handFidgetCount} icon={<Hand size={20}/>} color="orange" trend="Hand Entries" />
              <StatsCard label="Impact Events" value={currentStats.thumpCount} icon={<Zap size={20}/>} color="purple" trend="Detected Thumps" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden relative">
                <div className="flex items-center justify-between mb-2">
                   <h3 className="font-black text-slate-800 flex items-center gap-4 tracking-tighter text-2xl">
                     <BarChart3 className="text-indigo-500" /> Attention Flow Dynamics
                   </h3>
                </div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-8">Correlation: Gaze Presence vs. Engagement Stability</p>
                
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="timeStr" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} fontSize={10} axisLine={false} tickLine={false} />
                      
                      <Tooltip 
                         contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                         labelStyle={{ fontWeight: '900', color: '#1e293b' }}
                         content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-50">
                                <p className="font-black text-slate-900 mb-2">{label}</p>
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-bold text-slate-500">Engagement Depth:</span>
                                    <span className="text-xs font-black text-indigo-600">{Math.round(data.focusScore)}%</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-bold text-slate-500">Active Looking:</span>
                                    <span className={`text-xs font-black ${data.isLooking ? 'text-green-500' : 'text-rose-500'}`}>
                                      {data.isLooking ? 'ON SCREEN' : 'AVERTED'}
                                    </span>
                                  </div>
                                  {!data.isLooking && (
                                    <div className="flex items-center gap-1.5 text-rose-500 font-black text-[10px] uppercase pt-1">
                                      <ZapOff size={10} /> Focus Gap Detected
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                         }}
                      />
                      
                      <Legend verticalAlign="bottom" height={36} />
                      
                      {/* Visual Zones */}
                      <ReferenceArea y1={80} y2={100} fill="#dcfce7" fillOpacity={0.15} />
                      <ReferenceArea y1={0} y2={40} fill="#fee2e2" fillOpacity={0.15} />

                      <Area 
                        type="monotone" 
                        dataKey="focusScore" 
                        fill="#6366f1" 
                        fillOpacity={0.1} 
                        stroke="#6366f1" 
                        strokeWidth={4} 
                        name="Engagement Depth" 
                        animationDuration={1500}
                      />
                      
                      <Line 
                        type="stepAfter" 
                        dataKey={(d) => d.isLooking ? 95 : 5} 
                        stroke="#10b981" 
                        strokeWidth={4} 
                        name="Active Looking" 
                        dot={false}
                        strokeDasharray="5 5"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Visual Label for Zones */}
                <div className="absolute top-[105px] right-12 flex items-center gap-2 pointer-events-none opacity-40">
                   <div className="text-[10px] font-black text-green-500 uppercase tracking-widest">Flow Zone</div>
                   <div className="w-12 h-px bg-green-200" />
                </div>
                <div className="absolute bottom-[105px] right-12 flex items-center gap-2 pointer-events-none opacity-40">
                   <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Distraction Risk</div>
                   <div className="w-12 h-px bg-rose-200" />
                </div>
              </div>

              <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-2xl relative">
                <div className="flex items-center justify-between mb-2">
                   <h3 className="font-black text-slate-800 flex items-center gap-4 tracking-tighter text-2xl">
                     <Volume2 className="text-indigo-500" /> Sensory Stress Map
                   </h3>
                </div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-8">Correlation: Environmental Noise vs. Behavioral Triggers</p>
                
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis type="category" dataKey="timeStr" name="Session Time" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis type="number" dataKey="noiseLevel" name="Noise Level" fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} />
                      
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }} 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-50">
                                <p className="font-black text-slate-900 mb-2">{data.timeStr}</p>
                                <div className="space-y-1">
                                  <p className="text-xs font-bold text-indigo-600">Ambient Noise: {Math.round(data.noiseLevel)}%</p>
                                  {data.hasEvent ? (
                                    <div className="flex items-center gap-1.5 text-rose-500 font-black text-xs uppercase pt-1">
                                      <AlertTriangle size={12} /> Interference Triggered
                                    </div>
                                  ) : (
                                    <p className="text-xs font-bold text-slate-400 italic">Clear Sensory Window</p>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      
                      {/* Threshold for High Noise */}
                      <ReferenceArea y1={70} y2={100} fill="#fecaca" fillOpacity={0.1} />

                      <Scatter name="Steady Focus" data={chartData.filter(d => !d.hasEvent)} fill="#cbd5e1" />
                      <Scatter name="Focus Triggers" data={chartData.filter(d => d.hasEvent)} fill="#f43f5e">
                        {chartData.filter(d => d.hasEvent).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="#f43f5e" />
                        ))}
                      </Scatter>

                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="absolute top-[135px] right-12 flex items-center gap-2 pointer-events-none opacity-40">
                   <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest">High Noise Zone</div>
                   <div className="w-12 h-px bg-rose-200" />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-24 py-12 border-t border-slate-200/50 text-center">
        <div className="flex items-center justify-center gap-4 text-slate-400 font-black uppercase tracking-[0.4em] text-[10px]">
          <Sparkles size={16} className="text-indigo-400" /> 
          FocusFlow Forensic Analytics
        </div>
      </footer>
    </div>
  );
};

export default App;
