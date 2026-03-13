import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Sparkles, LayoutDashboard, 
  BarChart3, X, Zap, Cpu, 
  Globe, Layers, ChevronRight, Terminal, 
  ArrowRight, Database, Settings2, PlayCircle, ShieldCheck, 
  Rocket, BrainCircuit, Target, PenTool, ChevronLeft, ChevronDown, MonitorPlay, Paperclip, Search, Activity, AlertTriangle,
  Mail, FileText, Image as ImageIcon, FileSpreadsheet, Trash2, Link as LinkIcon, RefreshCw, Menu, Box, Download, Copy, Check, Loader2,
  TrendingUp, Users, Lightbulb, Fingerprint, Upload, Camera, SidebarClose, SidebarOpen, Plus, MessageSquarePlus
} from 'lucide-react';
import { generateResponseStream } from './services/geminiService.ts';
import { Message, Sender, BrandContext, Attachment } from './types';
import { INITIAL_BRAND_CONTEXT } from './constants';
import MarkdownRenderer from './components/MarkdownRenderer';
import ChartRenderer from './components/ChartRenderer';

const App: React.FC = () => {
  // --- STATE ---
  const [viewState, setViewState] = useState<'landing' | 'chat'>('landing');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [processingType, setProcessingType] = useState<string | undefined>(undefined); 
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [brandContext, setBrandContext] = useState<BrandContext>(INITIAL_BRAND_CONTEXT);
  const [longTermMemory, setLongTermMemory] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(true); // Default sidebar open on desktop
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Attachments State
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Agent Connectors State (Now Persisted)
  const [connectors, setConnectors] = useState({
    gmail: false,
    drive: false,
    googleSearch: true // Defaulted to TRUE for Live Data
  });
  
  // UX Enhancements States
  const [isBooting, setIsBooting] = useState(false);
  const [bootLog, setBootLog] = useState<string[]>([]);
  const [typewriterText, setTypewriterText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // SAFETY LOCK: Prevents auto-save loop when wiping data
  const isWipingRef = useRef(false);
  
  const bootLogs = [
    "Menghubungkan ke Server...",
    "Memuat KB-08: Nested Learning Protocol...",
    "Inisialisasi 4-Layer Memory...",
    "Kalibrasi Continuum Memory Systems...",
    "Deep Reasoning Module Aktif.",
    "Sistem Siap."
  ];

  // --- SAFETY HELPERS (DATA INTEGRITY) ---
  const isValidMessage = (m: any): boolean => {
    return (
      typeof m === 'object' &&
      m !== null &&
      typeof m.id === 'string' &&
      typeof m.text === 'string' &&
      (m.sender === Sender.USER || m.sender === Sender.BOT || m.sender === Sender.SYSTEM)
    );
  };

  // --- MEMORY PERSISTENCE ENGINE ---
  useEffect(() => {
    // RESET FLAG PROTOCOL: Check if a reset was requested before reload
    const isResetPending = localStorage.getItem('nexus_reset_pending');

    if (isResetPending) {
      console.log("Processing Pending Factory Reset...");
      localStorage.removeItem('nexus_reset_pending');
      // No need to remove items manually here, as localStorage.clear() in handleWipeMemory handles the clean slate
      // But purely for safety in case of weird browser behavior:
      localStorage.removeItem('nexus_messages');
      localStorage.removeItem('nexus_context');
      localStorage.removeItem('nexus_connectors');
      
      setMessages([]);
      setBrandContext(INITIAL_BRAND_CONTEXT);
      setConnectors({ gmail: false, drive: false, googleSearch: true });
      setViewState('landing');
      setIsInitialized(true);
      return; 
    }

    // Normal Load
    const savedMessages = localStorage.getItem('nexus_messages');
    const savedContext = localStorage.getItem('nexus_context');
    const savedConnectors = localStorage.getItem('nexus_connectors');
    const savedMemory = localStorage.getItem('nexus_long_term_memory');

    if (savedMemory) {
      setLongTermMemory(savedMemory);
    }

    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        // DEEP VALIDATION: Check strict array AND valid content
        if (Array.isArray(parsed)) {
            const hydrated = parsed
              .filter(isValidMessage) // Remove corrupted items
              .map((m: any) => ({
                ...m,
                // Safe Date Hydration
                timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
              }))
              .filter((m: any) => !isNaN(m.timestamp.getTime())); // Remove Invalid Dates

            if (hydrated.length > 0) {
              setMessages(hydrated);
              setViewState('chat');
            } else if (parsed.length > 0) {
              // If parsed had items but all were invalid
              console.warn("Found corrupted messages. Resetting history.");
              setMessages([]);
            }
        }
      } catch (e) {
        console.error("Memory corruption detected", e);
        localStorage.removeItem('nexus_messages');
      }
    }

    if (savedContext) {
      try {
        const parsed = JSON.parse(savedContext);
        if (typeof parsed === 'object' && parsed !== null) {
            setBrandContext({ ...INITIAL_BRAND_CONTEXT, ...parsed });
        }
      } catch (e) { 
        console.error("Context corruption", e); 
        setBrandContext(INITIAL_BRAND_CONTEXT);
      }
    }

    if (savedConnectors) {
      try {
        const parsed = JSON.parse(savedConnectors);
        if (typeof parsed === 'object') {
            setConnectors(parsed);
        }
      } catch (e) { console.error("Connector state corruption", e); }
    }

    setIsInitialized(true);
  }, []);

  // STORAGE GUARD PROTOCOL: Try-Catch save to prevent crashes on quota limit
  useEffect(() => {
    if (isInitialized && !isWipingRef.current) {
      try {
        localStorage.setItem('nexus_messages', JSON.stringify(messages));
      } catch (e) {
        console.error("Storage Quota Exceeded. Enabling Fail-safe Mode.", e);
        
        // Fail-safe: Strip images to save text history
        const textOnlyMessages = messages.map(msg => ({
          ...msg,
          imageUrl: undefined, // Remove heavy base64
          attachmentName: msg.attachmentName ? `${msg.attachmentName} (Image Removed - Storage Full)` : undefined
        }));

        try {
          localStorage.setItem('nexus_messages', JSON.stringify(textOnlyMessages));
          if (!errorMsg) setErrorMsg("⚠️ Penyimpanan penuh. Gambar lama tidak disimpan, teks aman.");
        } catch (retryError) {
          console.error("Critical Storage Failure", retryError);
          setErrorMsg("⚠️ Gagal menyimpan riwayat chat. Memori browser penuh.");
        }
      }
    }
  }, [messages, isInitialized]);

  useEffect(() => {
    if (isInitialized && !isWipingRef.current) {
        localStorage.setItem('nexus_context', JSON.stringify(brandContext));
    }
  }, [brandContext, isInitialized]);

  useEffect(() => {
    if (isInitialized && !isWipingRef.current) {
        localStorage.setItem('nexus_connectors', JSON.stringify(connectors));
    }
  }, [connectors, isInitialized]);

  useEffect(() => {
    if (isInitialized && !isWipingRef.current) {
        localStorage.setItem('nexus_long_term_memory', longTermMemory);
    }
  }, [longTermMemory, isInitialized]);

  // SMART SCROLL LOGIC
  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      
      if (isNearBottom) {
        scrollContainerRef.current.scrollTop = scrollHeight;
      }
    }
  }, [messages, isThinking]);

  useEffect(() => {
    if (viewState === 'chat' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [viewState]);

  // AUTO RESIZE TEXTAREA
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  // Typewriter Effect
  useEffect(() => {
    if (viewState === 'landing') {
      const text = "NEXT CREATOR";
      let i = 0;
      const interval = setInterval(() => {
        setTypewriterText(text.substring(0, i + 1));
        i++;
        if (i > text.length) clearInterval(interval);
      }, 150);
      return () => clearInterval(interval);
    }
  }, [viewState]);

  // --- HELPER: BRAND HEALTH SCORE (TYPE SAFE) ---
  const getBrandHealth = () => {
    const fields: (keyof BrandContext)[] = ['name', 'industry', 'niche', 'usp', 'painPoints', 'audience', 'contentPillars', 'voice', 'goal'];
    let filled = 0;
    fields.forEach(f => {
      const value = brandContext[f];
      if (value && value.length > 5) filled++;
    });
    return Math.round((filled / fields.length) * 100);
  };

  const healthScore = getBrandHealth();

  // --- ACTIONS ---

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        
        // FIX: Clean up audio context to prevent memory leak
        setTimeout(() => {
          ctx.close();
        }, 600);
      }
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const flashTitle = () => {
    const originalTitle = document.title;
    let count = 0;
    const interval = setInterval(() => {
      document.title = count % 2 === 0 ? "✨ Selesai!" : originalTitle;
      count++;
      if (count > 5) {
        clearInterval(interval);
        document.title = originalTitle;
      }
    }, 1000);
  };

  const handleDownload = (content: string, id: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strategy-result-${id.slice(-4)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartMission = () => {
    setIsBooting(true);
    let step = 0;
    
    const bootInterval = setInterval(() => {
      if (step < bootLogs.length) {
        setBootLog(prev => [...prev, bootLogs[step]]);
        step++;
      } else {
        clearInterval(bootInterval);
        setTimeout(() => {
          setIsBooting(false);
          setViewState('chat');
        }, 800);
      }
    }, 400);
  };

  // FULL RESET
  const handleWipeMemory = () => {
    if (window.confirm("⚠️ FACTORY RESET: Hapus SEMUA data, refresh aplikasi, dan mulai dari awal?")) {
      // Lock persistence to prevent auto-save during wipe
      isWipingRef.current = true;
      
      // Deep clean
      localStorage.clear();
      
      // Set flag for clean boot
      localStorage.setItem('nexus_reset_pending', 'true');
      
      // Force reload without cache
      window.location.replace('/?t=' + Date.now());
    }
  };

  // CLEAR CHAT ONLY (NEW CHAT)
  const handleClearChat = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Confimration only if there are messages
    if (messages.length > 0) {
        if (window.confirm("Mulai sesi baru? Riwayat chat saat ini akan dibersihkan.")) {
            // REACTIVE SYNC: Just update state, let useEffect handle storage
            setMessages([]); 
            setErrorMsg(null);
            setIsThinking(false);
            setProcessingType(undefined);
            if (window.innerWidth < 768) setShowSidebar(false); 
        }
    } else {
        // Just clear state if already empty (no confirm needed)
        setMessages([]);
        if (window.innerWidth < 768) setShowSidebar(false);
    }
  }

  const handleSaveToMemory = async () => {
    if (messages.length === 0) return;
    setIsThinking(true);
    try {
      const chatHistoryText = messages.map(m => `${m.sender === Sender.USER ? 'User' : 'AI'}: ${m.text}`).join('\n');
      
      let prompt = '';
      if (longTermMemory.length > 2000) {
        prompt = `Buatkan ringkasan eksekutif gabungan dari memori jangka panjang sebelumnya dan percakapan terbaru berikut. Fokus pada: 1. Preferensi audiens, 2. Ide campaign yang disetujui, 3. Gaya bahasa yang disukai. Output HANYA ringkasan padat (tanpa blok thinking).\n\nMemori Sebelumnya:\n${longTermMemory}\n\nPercakapan Terbaru:\n${chatHistoryText}`;
      } else {
        prompt = `Buatkan ringkasan eksekutif dari percakapan berikut. Fokus pada: 1. Preferensi audiens, 2. Ide campaign yang disetujui, 3. Gaya bahasa yang disukai. Output HANYA ringkasan (tanpa blok thinking).\n\nPercakapan:\n${chatHistoryText}`;
      }
      
      const { generateResponseStream } = await import('./services/geminiService.ts');
      const stream = await generateResponseStream(
        [], 
        prompt, 
        brandContext, 
        null,
        [],
        undefined,
        '' // No long term memory for the summarizer itself
      );
      
      let summary = '';
      for await (const chunk of stream) {
        if (chunk.text) summary += chunk.text;
      }
      
      if (longTermMemory.length > 2000) {
        setLongTermMemory(summary);
      } else {
        setLongTermMemory(prev => prev + '\n\n--- Sesi Baru ---\n' + summary);
      }
      alert("Sesi berhasil disimpan ke Long-Term Memory (RAG)!");
    } catch (e) {
      console.error("Failed to save memory", e);
      alert("Gagal menyimpan memori.");
    } finally {
      setIsThinking(false);
    }
  };

  // RESET CONTEXT ONLY
  const handleResetContext = () => {
    if (window.confirm("RESET KONTEKS: Hapus chat dan kembalikan pengaturan brand ke default?")) {
      // REACTIVE SYNC: Update states, effects will overwrite storage
      setMessages([]);
      setBrandContext(INITIAL_BRAND_CONTEXT);
      if (window.innerWidth < 768) setShowSidebar(false);
    }
  };

  // BRAIN EXPORT
  const handleExportBrain = () => {
    const backup = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        messages,
        brandContext,
        connectors
      }
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-brain-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // BRAIN IMPORT (WITH DEEP VALIDATION & STORAGE GUARD)
  const handleImportBrain = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // DEEP SCHEMA VALIDATION
        const hasTopLevel = 
            json.data && 
            Array.isArray(json.data.messages) && 
            typeof json.data.brandContext === 'object';
            
        // Deep Message Check
        const allMessagesValid = hasTopLevel && json.data.messages.every(isValidMessage);

        if (allMessagesValid) {
            if(window.confirm("Restore backup ini? Data saat ini akan ditimpa dan aplikasi akan dimuat ulang.")) {
              isWipingRef.current = true; // Lock persistence

              try {
                  // PRIMARY ATTEMPT
                  localStorage.setItem('nexus_messages', JSON.stringify(json.data.messages));
                  localStorage.setItem('nexus_context', JSON.stringify(json.data.brandContext));
                  localStorage.setItem('nexus_connectors', JSON.stringify(json.data.connectors || connectors));
                  
                  alert("Brain Restore Berhasil! Sistem akan dimuat ulang.");
              } catch (storageError) {
                  // FAIL-SAFE MODE
                  console.warn("Restore failed due to size. Attempting text-only restore...", storageError);
                  try {
                      const textOnlyMessages = json.data.messages.map((msg: any) => ({
                          ...msg,
                          imageUrl: undefined, // Strip images
                          attachmentName: msg.attachmentName ? `${msg.attachmentName} (Image Removed during Restore)` : undefined
                      }));

                      localStorage.setItem('nexus_messages', JSON.stringify(textOnlyMessages));
                      localStorage.setItem('nexus_context', JSON.stringify(json.data.brandContext));
                      localStorage.setItem('nexus_connectors', JSON.stringify(json.data.connectors || connectors));

                      alert("⚠️ PERINGATAN MEMORI: Backup berhasil dipulihkan, TAPI gambar dihapus karena penyimpanan browser penuh. Teks & strategi aman.");
                  } catch (fatalError) {
                       console.error("Fatal Restore Error", fatalError);
                       alert("❌ Gagal Restore: File terlalu besar. Kosongkan penyimpanan browser Anda.");
                       isWipingRef.current = false; 
                       return;
                  }
              }
              setTimeout(() => { window.location.reload(); }, 100);
            }
        } else {
            alert("⚠️ File backup RUSAK atau TIDAK VALID.");
        }
      } catch (err) {
        console.error(err);
        alert("⚠️ Gagal membaca file backup.");
      }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      const isTextFile = file.name.endsWith('.csv') || file.name.endsWith('.txt');

      if (isTextFile && file.size > 2 * 1024 * 1024) {
        alert("File CSV/TXT maksimal 2MB biar AI nggak overthinking!");
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        let mimeType = file.type;
        if (file.name.endsWith('.csv')) {
          mimeType = 'text/csv';
        }

        if (isTextFile) {
          const textContent = event.target?.result as string;
          setAttachment({
            file,
            previewUrl: URL.createObjectURL(file), // We can still use object URL for preview icon
            textContent: textContent,
            mimeType: mimeType
          });
        } else {
          const base64 = event.target?.result as string;
          const base64Data = base64.split(',')[1];
          setAttachment({
            file,
            previewUrl: URL.createObjectURL(file),
            base64: base64Data,
            mimeType: mimeType
          });
        }
      };
      
      if (isTextFile) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    }
  };

  const clearAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleConnector = (type: 'gmail' | 'drive' | 'googleSearch') => {
    setConnectors(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleSendMessage = async (text: string = inputText) => {
    if (!text.trim() && !attachment) return;
    if (isThinking) return;

    setErrorMsg(null);
    const userMsgId = Date.now().toString();
    
    const currentAttachment = attachment; 
    const currentMimeType = attachment?.mimeType;

    setProcessingType(currentMimeType);

    const newUserMessage: Message = {
      id: userMsgId,
      sender: Sender.USER,
      text: text, 
      timestamp: new Date(),
      // PERSISTENT IMAGE PROTOCOL: Use Base64 Data URI
      imageUrl: attachment?.mimeType.startsWith('image/') 
        ? `data:${attachment.mimeType};base64,${attachment.base64}` 
        : undefined,
      attachmentName: attachment?.file.name
    };

    setMessages(prev => [...prev, newUserMessage]);
    
    setInputText('');
    setAttachment(null); 
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsThinking(true);

    const botMsgId = (Date.now() + 1).toString();
    const initialBotMessage: Message = {
      id: botMsgId,
      sender: Sender.BOT,
      text: '',
      timestamp: new Date(),
      isStreaming: true
    };
    
    setMessages(prev => [...prev, initialBotMessage]);

    try {
      const activeTools = [];
      if (connectors.gmail) activeTools.push('Gmail');
      if (connectors.drive) activeTools.push('Google Drive');
      if (connectors.googleSearch) activeTools.push('Google Search');

      let promptText = newUserMessage.text;
      if (currentAttachment?.textContent) {
        promptText += `\n\n[Data Lampiran: ${currentAttachment.file.name}]\n${currentAttachment.textContent}`;
      }

      const stream = await generateResponseStream(
        messages, 
        promptText, 
        brandContext, 
        currentAttachment?.base64 ? { base64: currentAttachment.base64, mimeType: currentAttachment.mimeType } : null,
        activeTools,
        currentAttachment?.file.name,
        longTermMemory
      );

      let accumulatedText = '';
      let isFirstChunk = true;
      
      for await (const chunk of stream) {
        if (isFirstChunk) {
          setIsThinking(false);
          isFirstChunk = false;
        }

        if (chunk.text) {
          accumulatedText += chunk.text;
          
          setMessages(prev => prev.map(msg => {
            if (msg.id === botMsgId) return { ...msg, text: accumulatedText };
            return msg;
          }));
        }
      }

      let finalChartData = null;
      if (accumulatedText.includes('```json-chart')) {
         try {
           const match = accumulatedText.match(/```json-chart\s*([\s\S]*?)\s*```/);
           if (match && match[1]) {
             finalChartData = JSON.parse(match[1].trim());
           }
         } catch (e) {
           console.warn("Failed to parse chart data:", e);
         }
      }

      // DYNAMIC BRAND CONTEXT UPDATER
      if (accumulatedText.includes('```json-brand-update')) {
         try {
           const match = accumulatedText.match(/```json-brand-update\s*([\s\S]*?)\s*```/);
           if (match && match[1]) {
             const updatedContext = JSON.parse(match[1].trim());
             setBrandContext(prev => ({ ...prev, ...updatedContext }));
             console.log("Brand DNA Updated Automatically:", updatedContext);
             // Optionally, we can remove the block from the final text so user doesn't see it
             accumulatedText = accumulatedText.replace(/```json-brand-update\s*([\s\S]*?)\s*```/, '');
           }
         } catch (e) {
           console.warn("Failed to parse brand update data:", e);
         }
      }

      setMessages(prev => prev.map(msg => {
        if (msg.id === botMsgId) {
          return { ...msg, text: accumulatedText, isStreaming: false, chartData: finalChartData };
        }
        return msg;
      }));

      playNotificationSound();
      flashTitle();

    } catch (error: any) {
      console.error(error);
      setMessages(prev => prev.filter(msg => msg.id !== botMsgId));
      
      setErrorMsg("Koneksi terputus. Silakan coba lagi.");
      
      const errorId = Date.now().toString();
      setMessages(prev => [...prev, {
        id: errorId,
        sender: Sender.SYSTEM,
        text: "⚠️ **SYSTEM ERROR**: Terjadi gangguan koneksi ke server AI. Coba refresh atau kirim pesan ulang.",
        timestamp: new Date()
      }]);
    } finally {
      setIsThinking(false); 
      setProcessingType(undefined);
    }
  };

  const handleContextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBrandContext(prev => ({ ...prev, [name]: value }));
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  // --- RENDERERS ---

  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center font-mono text-primary p-10">
        <div className="w-full max-w-lg space-y-2">
           <div className="h-1 w-full bg-surface mb-8 relative overflow-hidden rounded-full">
             <div className="absolute top-0 left-0 h-full bg-primary animate-pulse" style={{ width: `${(bootLog.length / bootLogs.length) * 100}%`, transition: 'width 0.3s ease' }}></div>
           </div>
           {bootLog.map((log, i) => (
             <div key={i} className="text-sm md:text-base animate-in fade-in slide-in-from-left-2 duration-300">
               <span className="text-accent mr-2">{'>'}</span>{log}
             </div>
           ))}
           <div className="animate-pulse text-accent">_</div>
        </div>
      </div>
    );
  }

  // LANDING PAGE
  if (viewState === 'landing') {
    return (
      <div className="w-full bg-background text-text_primary relative selection:bg-primary selection:text-black font-sans">
        
        {/* Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-50 nav-glass h-16 md:h-20 flex items-center justify-between px-4 md:px-12">
           <div className="flex items-center gap-2 md:gap-3">
             <Box className="text-primary w-6 h-6 md:w-auto md:h-auto" size={24} />
             <div className="flex flex-col">
                <span className="text-base md:text-xl font-display font-bold text-white tracking-tight leading-none">THE NEXT CREATOR</span>
                <span className="hidden md:block text-[9px] font-mono text-text_secondary uppercase tracking-widest leading-none">By Kreator Jombang</span>
             </div>
           </div>
           
           <div className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-wider text-text_secondary">
             <button onClick={() => scrollToSection('features')} className="hover:text-primary transition-colors">Fitur</button>
             <button onClick={() => scrollToSection('story')} className="hover:text-primary transition-colors">Tentang Kami</button>
             <button onClick={() => scrollToSection('calibration')} className="hover:text-primary transition-colors">Mulai</button>
           </div>
           
           <button 
             onClick={handleStartMission}
             className="px-4 py-2 bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 rounded text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all"
           >
             Dashboard
           </button>
        </nav>

        {/* Persistent Background FX */}
        <div className="fixed inset-0 bg-web3-grid pointer-events-none"></div>

        {/* SECTION 1: HERO */}
        <section className="min-h-[90vh] md:min-h-screen pt-24 md:pt-24 pb-12 flex items-center relative z-10 px-4 md:px-12 border-b border-white/5 overflow-hidden">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-12 items-center">
            
            {/* Left: Text */}
            <div className="space-y-4 md:space-y-8 animate-in fade-in slide-in-from-left-10 duration-1000 order-2 md:order-1 text-center md:text-left">
               <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-primary/20 bg-primary/5 text-[10px] font-mono tracking-widest text-primary uppercase">
                 <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                 AI Agent Khusus Kreator
               </div>
               
               <h1 className="text-4xl md:text-7xl font-display font-bold tracking-tight text-white leading-[1.1] md:leading-[1.1]">
                 Berhenti Asal Posting.<br/>
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Mulai Bangun Storytelling.</span>
               </h1>
               
               <p className="text-sm md:text-lg text-text_secondary max-w-lg leading-relaxed mx-auto md:mx-0">
                 Algoritma udah capek dikasih konten jualan yang kaku. Kami bantu racik ide organik dari data sentimen beneran, bukan sekadar nebak. Biar AI yang pusing mikir strategi, kamu tinggal eksekusi.
               </p>
               
               <div className="flex flex-wrap gap-3 pt-4 justify-center md:justify-start">
                 <button 
                   onClick={handleStartMission}
                   className="flex-1 md:flex-none px-6 py-3 md:px-8 md:py-4 bg-btn-gradient text-white rounded font-bold uppercase tracking-wider hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all transform hover:-translate-y-1 text-xs md:text-base text-center"
                 >
                   Buka Dashboard
                 </button>
                 <button 
                   onClick={() => scrollToSection('story')}
                   className="flex-1 md:flex-none px-6 py-3 md:px-8 md:py-4 bg-transparent border border-white/20 text-white rounded font-bold uppercase tracking-wider hover:bg-white/5 transition-all text-xs md:text-base text-center"
                 >
                   Lihat Cara Kerjanya
                 </button>
               </div>
            </div>

            {/* Right: NEW 3D ROBOT */}
            <div className="flex items-center justify-center relative h-[200px] md:h-[450px] animate-in fade-in zoom-in duration-1000 delay-300 order-1 md:order-2 md:pointer-events-auto">
               <div className="robot-container">
                  <div className="halo-ring"></div>
                  <div className="neck"></div>
                  <div className="robot-head">
                    <div className="ear-left"></div>
                    <div className="ear-right"></div>
                    <div className="face-screen">
                      <div className="face-grid"></div>
                      <div className="eyes-container">
                        <div className="eye"></div>
                        <div className="eye"></div>
                      </div>
                      <div className="face-reflection"></div>
                    </div>
                  </div>
                  <div className="robot-body-top">
                    <div className="status-light l-red"></div>
                    <div className="status-light l-blue"></div>
                    <div className="status-light l-green"></div>
                  </div>
               </div>
            </div>

          </div>
        </section>

        {/* STATS TICKER */}
        <div className="border-b border-white/5 bg-surface/50 backdrop-blur-sm overflow-hidden py-4 relative z-20">
           <div className="relative w-full flex overflow-hidden mask-linear-fade">
             {/* Part 1 */}
             <div className="flex animate-marquee whitespace-nowrap min-w-full shrink-0 items-center gap-12 px-6">
                {[
                  { label: "Konten Tergenerate", val: "1.2M+" },
                  { label: "Kreator Bergabung", val: "8,400+" },
                  { label: "Teknologi", val: "Nested Learning" },
                  { label: "Uptime", val: "99.99%" },
                  { label: "Engagement", val: "+40%" },
                  { label: "Analisa Data", val: "Real-time" }
                ].map((stat, i) => (
                  <div key={i} className="flex items-center gap-3">
                     <span className="text-text_secondary text-[10px] md:text-xs font-mono uppercase tracking-wider">{stat.label}</span>
                     <span className="text-white font-display font-bold text-sm md:text-base">{stat.val}</span>
                  </div>
                ))}
             </div>
             {/* Part 2 */}
             <div className="flex animate-marquee whitespace-nowrap min-w-full shrink-0 items-center gap-12 px-6" aria-hidden="true">
                {[
                  { label: "Konten Tergenerate", val: "1.2M+" },
                  { label: "Kreator Bergabung", val: "8,400+" },
                  { label: "Teknologi", val: "Nested Learning" },
                  { label: "Uptime", val: "99.99%" },
                  { label: "Engagement", val: "+40%" },
                  { label: "Analisa Data", val: "Real-time" }
                ].map((stat, i) => (
                  <div key={`dup-${i}`} className="flex items-center gap-3">
                     <span className="text-text_secondary text-[10px] md:text-xs font-mono uppercase tracking-wider">{stat.label}</span>
                     <span className="text-white font-display font-bold text-sm md:text-base">{stat.val}</span>
                  </div>
                ))}
             </div>
           </div>
        </div>

        {/* SECTION 2: FEATURES */}
        <section id="features" className="py-20 md:py-24 px-4 md:px-12 relative z-10">
          <div className="max-w-7xl mx-auto">
             <div className="text-center mb-12 md:mb-16 space-y-4">
               <h2 className="text-3xl md:text-5xl font-display font-bold text-white">Apa Yang Bisa Kami Bantu?</h2>
               <p className="text-text_secondary max-w-2xl mx-auto">Tools lengkap untuk kamu yang ingin serius di dunia digital.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: <Globe size={24}/>, title: "Riset Market", desc: "Cari tahu apa yang lagi diobrolin orang, biar konten kamu nggak ketinggalan zaman.", color: "text-blue-400" },
                  { icon: <BrainCircuit size={24}/>, title: "Strategi Konten", desc: "Susun rencana posting yang rapi. Gak ada lagi bingung 'besok posting apa?'.", color: "text-purple-400" },
                  { icon: <PenTool size={24}/>, title: "Copywriting", desc: "Bikin caption yang enak dibaca dan ngena di hati audiens kamu.", color: "text-primary" },
                  { icon: <BarChart3 size={24}/>, title: "Analisa Data", desc: "Baca performa akun kamu semudah membaca komik. Simpel dan jelas.", color: "text-green-400" }
                ].map((feature, i) => (
                  <div key={i} className="feature-card p-6 md:p-8 group cursor-default rounded-xl">
                     <div className={`mb-6 p-3 w-fit rounded bg-white/5 border border-white/10 ${feature.color} group-hover:scale-110 transition-transform`}>
                        {feature.icon}
                     </div>
                     <h3 className="text-xl font-display font-bold text-white mb-3">{feature.title}</h3>
                     <p className="text-sm text-text_secondary leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
             </div>
          </div>
        </section>

        {/* SECTION 3: STORY */}
        <section id="story" className="py-20 md:py-24 px-4 md:px-12 bg-surface/30 border-y border-white/5">
           <div className="max-w-4xl mx-auto items-center text-center">
              <div className="space-y-8">
                 <h2 className="text-3xl md:text-5xl font-display font-bold text-white">Cerita Kami</h2>
                 <div className="text-text_secondary text-base md:text-lg leading-relaxed space-y-6">
                    <p>
                      Menjadi konten kreator itu seringkali terasa sepi. Kita harus memikirkan ide, produksi, sampai analisa sendirian. Kadang rasanya buntu dan lelah karena hasil tidak sesuai harapan.
                    </p>
                    <p>
                      Padahal, masalahnya bukan di kreativitas kamu, tapi di strategi yang belum tajam. Dunia digital berubah cepat, dan mengejarnya sendirian itu berat.
                    </p>
                    <p>
                      The Next Creator by Kreator Jombang hadir untuk menemani perjalananmu. Kami bukan sekadar alat, tapi partner diskusi yang siap 24 jam. Kami bantu menerjemahkan data rumit menjadi saran yang mudah dimengerti.
                    </p>
                    <p>
                      Tujuan kami simpel: membuat kamu lebih fokus berkarya tanpa pusing mikirin algoritma. Yuk, kita mulai babak baru yang lebih seru dan produktif bersama.
                    </p>
                 </div>
                 <div className="pt-6">
                   <button onClick={handleStartMission} className="text-primary font-bold uppercase tracking-wider inline-flex items-center gap-2 hover:gap-4 transition-all">
                      Gabung Sekarang <ArrowRight size={16} />
                   </button>
                 </div>
              </div>
           </div>
        </section>

        {/* SECTION 4: CTA */}
        <section id="calibration" className="py-24 md:py-32 px-6 text-center relative overflow-hidden">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-primary/10 blur-[80px] md:blur-[120px] rounded-full pointer-events-none"></div>
           <div className="relative z-10 max-w-3xl mx-auto space-y-8">
              <h2 className="text-3xl md:text-6xl font-display font-bold text-white">Siap Untuk Upgrade?</h2>
              <p className="text-lg md:text-xl text-text_secondary">Saatnya kontenmu naik kelas. Atur strategi sekarang.</p>
              <button 
                onClick={handleStartMission}
                className="px-10 py-4 md:px-12 md:py-5 bg-white text-black text-base md:text-lg font-bold uppercase tracking-wider hover:bg-primary hover:text-white transition-all hover:shadow-[0_0_50px_rgba(59,130,246,0.5)] rounded-full"
              >
                Buka Dashboard
              </button>
           </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-12 px-6 bg-black text-center">
           <div className="flex items-center justify-center gap-2 mb-4 text-white font-display font-bold text-xl">
             <Box size={24} className="text-primary"/> THE NEXT CREATOR
           </div>
           <p className="text-text_secondary text-xs font-mono uppercase tracking-widest">
             © 2025 Kreator Jombang. All Rights Reserved.
           </p>
        </footer>

      </div>
    );
  }

  // --- CHAT WORKSPACE VIEW (CHATGPT-NATIVE LAYOUT) ---
  return (
    <div className="flex w-full h-[100dvh] bg-[#0B0E17] text-text_primary font-sans overflow-hidden">
      
      {/* 1. LEFT SIDEBAR (CONTEXT & SETTINGS) */}
      <div 
        className={`
          flex-shrink-0 bg-[#000000] border-r border-white/10 flex flex-col transition-all duration-300
          ${showSidebar ? 'w-[280px] translate-x-0' : 'w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden'}
          fixed md:relative inset-y-0 left-0 z-50
        `}
      >
         {/* Sidebar Header: New Chat */}
         <div className="p-4 border-b border-white/5">
             <button 
                onClick={(e) => handleClearChat(e)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-surface_card hover:bg-white/10 text-white transition-all border border-white/5 group"
             >
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white/5 rounded-md text-white">
                        <MessageSquarePlus size={18}/>
                    </div>
                    <span className="text-sm font-bold font-display tracking-wide">New Chat</span>
                </div>
                <PenTool size={14} className="text-text_secondary opacity-0 group-hover:opacity-100 transition-opacity"/>
             </button>

             <button 
                onClick={handleSaveToMemory}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-surface_card hover:bg-white/10 text-white transition-all border border-white/5 group mt-2"
             >
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white/5 rounded-md text-white">
                        <Database size={18}/>
                    </div>
                    <span className="text-sm font-bold font-display tracking-wide">Save to Memory (RAG)</span>
                </div>
                <Check size={14} className="text-text_secondary opacity-0 group-hover:opacity-100 transition-opacity"/>
             </button>
         </div>

         {/* Sidebar Content: Brand Context */}
         <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
            
            {/* Health Score */}
            <div className="bg-surface_card/30 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-text_secondary uppercase flex items-center gap-2">
                      <Activity size={12} className={healthScore > 80 ? 'text-green-400' : healthScore > 50 ? 'text-yellow-400' : 'text-red-400'}/>
                      Brand DNA
                  </span>
                  <span className="text-[10px] font-mono font-bold text-primary">{healthScore}%</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${healthScore > 80 ? 'bg-green-500' : healthScore > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                    style={{ width: `${healthScore}%` }}
                  ></div>
                </div>
            </div>

            {/* Context Inputs */}
            <div className="space-y-4">
               <div className="px-1 text-[10px] font-bold text-text_secondary uppercase tracking-widest flex items-center gap-2 mb-2">
                 <Settings2 size={12} /> Strategic Context
               </div>
               
               <div className="space-y-3">
                  <input 
                    name="name"
                    value={brandContext.name || ''}
                    onChange={handleContextChange}
                    className="w-full bg-transparent border border-white/10 rounded px-3 py-2.5 text-xs text-white placeholder:text-gray-600 focus:border-primary focus:outline-none transition-colors focus:bg-white/5"
                    placeholder="Brand Name"
                  />
                  <textarea 
                    name="usp"
                    value={brandContext.usp || ''}
                    onChange={handleContextChange}
                    className="w-full bg-transparent border border-white/10 rounded px-3 py-2.5 text-xs text-white placeholder:text-gray-600 focus:border-primary focus:outline-none transition-colors resize-none h-20 focus:bg-white/5 leading-relaxed"
                    placeholder="Unique Selling Point (USP)"
                  />
                  <input 
                    name="target"
                    value={brandContext.audience || ''}
                    onChange={handleContextChange}
                    className="w-full bg-transparent border border-white/10 rounded px-3 py-2.5 text-xs text-white placeholder:text-gray-600 focus:border-primary focus:outline-none transition-colors focus:bg-white/5"
                    placeholder="Target Audience"
                  />
                   <input 
                    name="contentPillars"
                    value={brandContext.contentPillars || ''}
                    onChange={handleContextChange}
                    className="w-full bg-transparent border border-white/10 rounded px-3 py-2.5 text-xs text-white placeholder:text-gray-600 focus:border-primary focus:outline-none transition-colors focus:bg-white/5"
                    placeholder="Content Pillars"
                  />
               </div>
            </div>

             {/* Tools */}
            <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="px-1 text-[10px] font-bold text-text_secondary uppercase tracking-widest flex items-center gap-2">
                   <Globe size={12} /> Live Integrations
                </div>
                <div 
                   onClick={() => toggleConnector('googleSearch')}
                   className="flex items-center justify-between p-2 rounded cursor-pointer hover:bg-white/5 transition-colors group"
                >
                   <span className="text-xs text-gray-300 group-hover:text-white">Google Search</span>
                   <div className={`w-8 h-4 rounded-full relative transition-colors ${connectors.googleSearch ? 'bg-primary/80' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${connectors.googleSearch ? 'translate-x-4' : ''}`}></div>
                   </div>
                </div>
            </div>

         </div>

         {/* Sidebar Footer */}
         <div className="p-4 border-t border-white/5 bg-black/40 space-y-3">
             <div className="grid grid-cols-2 gap-2">
                <button onClick={handleExportBrain} className="py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[10px] text-gray-400 hover:text-white uppercase font-bold tracking-wider transition-colors flex items-center justify-center gap-2">
                   <Download size={12}/> Backup
                </button>
                <button onClick={() => importInputRef.current?.click()} className="py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[10px] text-gray-400 hover:text-white uppercase font-bold tracking-wider transition-colors flex items-center justify-center gap-2">
                   <Upload size={12}/> Restore
                </button>
                <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImportBrain}/>
             </div>
             <button onClick={handleWipeMemory} className="w-full py-2 text-[10px] text-red-500/50 hover:text-red-400 uppercase font-bold tracking-widest text-center transition-colors">
                Factory Reset
             </button>
         </div>
      </div>

      {/* MOBILE OVERLAY */}
      {showSidebar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setShowSidebar(false)}></div>
      )}

      {/* 2. MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col relative h-full w-full bg-[#0B0E17]">
        
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#0B0E17]/80 backdrop-blur absolute top-0 left-0 right-0 z-10">
           <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowSidebar(!showSidebar)}
                className="text-text_secondary hover:text-white transition-colors p-2 hover:bg-white/5 rounded-md"
              >
                 {showSidebar ? <SidebarClose size={20}/> : <SidebarOpen size={20}/>}
              </button>
              <div className="flex items-center gap-2">
                 <span className="text-sm font-display font-bold text-white tracking-wide">The Next Creator</span>
                 <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono tracking-wider">PRO</span>
              </div>
           </div>
           
           <button onClick={() => setViewState('landing')} className="text-text_secondary hover:text-white text-xs uppercase font-bold tracking-widest">
              Exit
           </button>
        </header>

        {/* Messages Scroll Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scroll-smooth pt-20 pb-40 px-4 md:px-0">
           {messages.length === 0 ? (
             /* EMPTY STATE (ChatGPT Style) */
             <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-2xl mx-auto animate-in fade-in zoom-in duration-500 px-4">
                <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/5 shadow-2xl">
                   <Box size={40} className="text-white"/>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 text-center">Hello, Creator.</h2>
                <p className="text-text_secondary text-center mb-10 max-w-md text-sm">
                   Siap meracik strategi konten viral hari ini? Pilih salah satu opsi di bawah untuk memulai.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                   {[
                     { icon: <ShieldCheck size={16}/>, label: "Audit Brand", prompt: "Saya butuh audit lengkap untuk akun brand saya. Tolong berikan penilaian jujur soal First Impression, Bio, dan Konsistensi Konten saya saat ini. Gunakan Protocol Nested Learning (KB-08)." },
                     { icon: <Camera size={16}/>, label: "Visual Brief", prompt: "Saya butuh visual brief lengkap untuk konten Instagram Reels produk saya. Tolong berikan detail lighting, camera angle, dan style visual." },
                     { icon: <Zap size={16}/>, label: "Riset Viral", prompt: "Cari di internet (Google Search) apa yang sedang viral hari ini di Indonesia. Gunakan 'Continuum Memory Systems' untuk menghubungkannya dengan konteks brand saya." },
                     { icon: <TrendingUp size={16}/>, label: "Post-Mortem", prompt: "Saya punya data performa konten minggu lalu (Views, Likes, Saves). Saya ingin melakukan Data Post-Mortem untuk mencari pola keberhasilan." }
                   ].map((item, i) => (
                      <button 
                        key={i} 
                        onClick={() => handleSendMessage(item.prompt)}
                        className="p-4 rounded-xl border border-white/5 bg-surface_card/50 hover:bg-surface_card hover:border-white/10 transition-all text-left group"
                      >
                         <div className="flex items-center gap-2 mb-1.5 text-gray-200 font-bold text-xs group-hover:text-white transition-colors">
                            {item.icon} {item.label}
                         </div>
                         <p className="text-[10px] text-text_secondary truncate opacity-70">Klik untuk memulai...</p>
                      </button>
                   ))}
                </div>
             </div>
           ) : (
             /* MESSAGE LIST */
             <div className="max-w-3xl mx-auto space-y-8">
                {messages.map((msg) => (
                  <div key={msg.id} className={`group ${msg.sender === Sender.USER ? '' : ''}`}>
                     
                     {/* User Message */}
                     {msg.sender === Sender.USER && (
                        <div className="flex justify-end mb-2">
                           <div className="bg-[#2A2A2A] text-white px-5 py-3.5 rounded-[26px] rounded-br-none max-w-[85%] text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                              {msg.text}
                              {msg.imageUrl && (
                                <div className="mt-3 rounded-lg overflow-hidden border border-white/10">
                                  <img src={msg.imageUrl} alt="Uploaded" className="w-full h-auto object-cover" />
                                </div>
                              )}
                           </div>
                        </div>
                     )}

                     {/* Bot Message */}
                     {(msg.sender === Sender.BOT || msg.sender === Sender.SYSTEM) && (
                        <div className="flex gap-4">
                           <div className="flex-shrink-0 mt-1">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg border border-white/10">
                                 <Sparkles size={14} className="text-white"/>
                              </div>
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                                 The Next Creator
                                 {msg.sender === Sender.SYSTEM && <span className="text-[10px] bg-red-500/20 text-red-400 px-1 rounded">SYSTEM</span>}
                              </div>
                              <div className="text-gray-300 text-sm md:text-base leading-relaxed">
                                  <MarkdownRenderer content={msg.text} />
                                  {msg.chartData && <div className="mt-4"><ChartRenderer data={msg.chartData} /></div>}
                              </div>
                              
                              {/* Actions */}
                              {!msg.isStreaming && (
                                 <div className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleCopy(msg.text, msg.id)} className="p-1.5 hover:bg-white/10 rounded-md text-gray-500 hover:text-white transition-colors"><Copy size={14}/></button>
                                    <button onClick={() => handleDownload(msg.text, msg.id)} className="p-1.5 hover:bg-white/10 rounded-md text-gray-500 hover:text-white transition-colors"><Download size={14}/></button>
                                 </div>
                              )}
                           </div>
                        </div>
                     )}

                  </div>
                ))}
                
                {/* Inline Thinking Indicator (No Gimmick Modal) */}
                {isThinking && (
                   <div className="flex gap-4 animate-pulse">
                       <div className="w-8 h-8 rounded-full bg-surface_card border border-white/10 flex items-center justify-center">
                          <Sparkles size={14} className="text-text_secondary"/>
                       </div>
                       <div className="flex items-center gap-2 mt-2">
                          <div className="w-2 h-2 rounded-full bg-primary animate-bounce"></div>
                          <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-100"></div>
                          <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-200"></div>
                       </div>
                   </div>
                )}
                
                <div ref={messagesEndRef} className="h-4"/>
             </div>
           )}
        </div>

        {/* 3. INPUT AREA (FLOATING & CENTERED) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-[#0B0E17] via-[#0B0E17] to-transparent z-20">
           <div className="max-w-3xl mx-auto">
              
              {/* Attachment Preview */}
              {attachment && (
                <div className="mb-3 mx-2 p-2 w-fit bg-[#1E1E1E] border border-white/10 rounded-xl flex items-center gap-3 shadow-lg animate-in slide-in-from-bottom-2">
                    {attachment.mimeType.startsWith('image/') ? (
                      <img src={attachment.previewUrl} className="w-12 h-12 object-cover rounded-lg" alt="Preview"/>
                    ) : (
                      <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center"><FileText size={20} className="text-gray-400"/></div>
                    )}
                    <div className="flex flex-col pr-2">
                      <span className="text-xs font-bold text-white max-w-[150px] truncate">{attachment.file.name}</span>
                      <button onClick={clearAttachment} className="text-[10px] text-red-400 hover:text-red-300 text-left mt-0.5">Remove file</button>
                    </div>
                </div>
              )}

              {/* Input Capsule */}
              <div className="relative flex items-end gap-2 bg-[#1E1E1E] border border-white/10 rounded-[26px] p-2 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)] focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 transition-all">
                 {/* Attachment Button */}
                 <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,.csv,.txt,.pdf"/>
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="p-3 rounded-full hover:bg-white/10 text-text_secondary hover:text-white transition-colors mb-0.5"
                 >
                   <Paperclip size={20}/>
                 </button>

                 {/* Text Area */}
                 <textarea 
                   ref={textareaRef}
                   value={inputText}
                   onChange={(e) => setInputText(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleSendMessage();
                     }
                   }}
                   placeholder="Ketik strategi atau perintah..."
                   className="flex-1 bg-transparent border-0 focus:ring-0 text-white placeholder:text-gray-500 resize-none py-3.5 px-2 max-h-[200px] min-h-[50px] scrollbar-hide text-sm md:text-base"
                   style={{ height: '52px' }}
                 />

                 {/* Send Button */}
                 <button 
                   onClick={() => handleSendMessage()}
                   disabled={(!inputText.trim() && !attachment) || isThinking}
                   className={`p-3 rounded-full transition-all mb-0.5 mr-1 ${
                     (!inputText.trim() && !attachment) || isThinking 
                       ? 'bg-white/5 text-gray-600 cursor-not-allowed' 
                       : 'bg-white text-black hover:bg-gray-200'
                   }`}
                 >
                   {isThinking ? <Loader2 size={20} className="animate-spin"/> : <ArrowRight size={20} strokeWidth={2.5}/>}
                 </button>
              </div>
              
              <div className="text-center mt-3">
                 <p className="text-[10px] text-gray-500 font-mono">
                   The Next Creator v2.0 (Nested Learning Protocol). Check results for accuracy.
                 </p>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default App;