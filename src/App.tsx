import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  Mic,
  MicOff,
  Send,
  Volume2,
  Square,
  RotateCcw,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  SupportedLanguage,
  LANGUAGE_OPTIONS,
  WELCOME_MESSAGE,
  SPEECH_FAIL_MESSAGE,
  UI_TEXT,
} from './i18n/translations';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audioDataUrl?: string;
}

type MicState = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: {
        transcript: string;
      };
    };
  };
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onspeechend: (() => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

export default function App() {
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('hi');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: WELCOME_MESSAGE,
    },
  ]);

  const [inputValue, setInputValue] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  // Microphone & Speech Recognition state
  const [micState, setMicState] = useState<MicState>('idle');
  const [micStatusMessage, setMicStatusMessage] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recognizedTextRef = useRef<string>('');
  const hadRecognitionErrorRef = useRef<boolean>(false);

  // MediaRecorder fallback refs (when SpeechRecognition API is missing)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Audio playback (TTS) state
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const ui = UI_TEXT[selectedLanguage];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  // Cleanup audio and speech recognition on unmount
  useEffect(() => {
    return () => {
      stopAllAudioPlayback();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const stopAllAudioPlayback = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingMessageId(null);
    setLoadingAudioId(null);
  };

  const speakWithBrowserFallback = (text: string, messageId: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setPlayingMessageId(null);
      setLoadingAudioId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    utterance.lang = hasDevanagari || selectedLanguage === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.96;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith(hasDevanagari ? 'hi' : 'en-in') &&
          (v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('google'))
      ) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(hasDevanagari ? 'hi' : 'en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setLoadingAudioId(null);
      setPlayingMessageId(messageId);
    };
    utterance.onend = () => {
      setPlayingMessageId((prev) => (prev === messageId ? null : prev));
    };
    utterance.onerror = () => {
      setLoadingAudioId(null);
      setPlayingMessageId((prev) => (prev === messageId ? null : prev));
    };

    setLoadingAudioId(null);
    setPlayingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const handleTogglePlayMessage = async (msg: ChatMessage) => {
    if (playingMessageId === msg.id || loadingAudioId === msg.id) {
      stopAllAudioPlayback();
      return;
    }

    stopAllAudioPlayback();

    // If we already cached Gemini TTS audio for this message, play it immediately
    if (msg.audioDataUrl) {
      try {
        const audio = new Audio(msg.audioDataUrl);
        activeAudioRef.current = audio;
        setPlayingMessageId(msg.id);
        audio.onended = () => {
          setPlayingMessageId((prev) => (prev === msg.id ? null : prev));
          activeAudioRef.current = null;
        };
        audio.onerror = () => {
          activeAudioRef.current = null;
          speakWithBrowserFallback(msg.content, msg.id);
        };
        await audio.play();
        return;
      } catch {
        speakWithBrowserFallback(msg.id === 'welcome-msg' ? msg.content : msg.content, msg.id);
        return;
      }
    }

    setLoadingAudioId(msg.id);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.content }),
      });

      if (!response.ok) {
        throw new Error('TTS API failed');
      }

      const data = await response.json();
      if (!data.audioBase64) {
        throw new Error('Empty audio data');
      }

      const dataUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, audioDataUrl: dataUrl } : m))
      );

      const audio = new Audio(dataUrl);
      activeAudioRef.current = audio;
      setLoadingAudioId(null);
      setPlayingMessageId(msg.id);

      audio.onended = () => {
        setPlayingMessageId((prev) => (prev === msg.id ? null : prev));
        activeAudioRef.current = null;
      };
      audio.onerror = () => {
        activeAudioRef.current = null;
        speakWithBrowserFallback(msg.content, msg.id);
      };

      await audio.play();
    } catch {
      // Graceful fallback to browser speech synthesis if server TTS fails
      speakWithBrowserFallback(msg.content, msg.id);
    }
  };

  const sendMessage = async (textOverride?: string) => {
    const textToSend = (textOverride !== undefined ? textOverride : inputValue).trim();

    if (!textToSend) {
      setMicStatusMessage(ui.emptyInputHint);
      return;
    }

    setApiError(null);
    setLastFailedPrompt(null);
    setMicStatusMessage(null);
    if (micState === 'error') {
      setMicState('idle');
    }

    setInputValue('');

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
    };

    const currentHistory = messages.filter((m) => m.id !== 'welcome-msg');
    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          selectedLanguage,
          history: currentHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      if (!data.reply) {
        throw new Error('Empty reply');
      }

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setApiError(ui.networkError);
      setLastFailedPrompt(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleRetryLastFailed = async () => {
    if (!lastFailedPrompt || isSending) return;
    const promptToRetry = lastFailedPrompt;
    setApiError(null);
    setLastFailedPrompt(null);
    setIsSending(true);

    try {
      const currentHistory = messages
        .filter((m) => m.id !== 'welcome-msg')
        .slice(0, -1); // exclude the last user message since we re-send it

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptToRetry,
          selectedLanguage,
          history: currentHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Retry failed');
      }

      const data = await response.json();
      if (!data.reply) {
        throw new Error('Empty reply');
      }

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setApiError(ui.networkError);
      setLastFailedPrompt(promptToRetry);
    } finally {
      setIsSending(false);
    }
  };

  // Voice Recognition Handler
  const handleMicToggle = async () => {
    setApiError(null);

    // If currently listening, stop listening and process
    if (micState === 'listening') {
      setMicState('processing');
      setMicStatusMessage(ui.micProcessingStatus);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      return;
    }

    if (micState === 'processing') {
      return;
    }

    stopAllAudioPlayback();

    const SpeechRecognitionCtor =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;

    if (SpeechRecognitionCtor) {
      try {
        const recognition = new SpeechRecognitionCtor();
        recognitionRef.current = recognition;
        recognizedTextRef.current = '';
        hadRecognitionErrorRef.current = false;

        recognition.lang = selectedLanguage === 'en' ? 'en-IN' : 'hi-IN';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        setMicState('listening');
        setMicStatusMessage(ui.micListeningStatus);

        recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript;
          }
          const cleaned = fullTranscript.trim();
          recognizedTextRef.current = cleaned;
          // Show recognized words in the chat input so user sees what was understood
          setInputValue(cleaned);
        };

        recognition.onspeechend = () => {
          setMicState('processing');
          setMicStatusMessage(ui.micProcessingStatus);
          try {
            recognition.stop();
          } catch {
            // ignore
          }
        };

        recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
          hadRecognitionErrorRef.current = true;
          setMicState('error');
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setMicStatusMessage(ui.micPermissionDenied);
          } else {
            setMicStatusMessage(SPEECH_FAIL_MESSAGE);
          }
        };

        recognition.onend = () => {
          recognitionRef.current = null;
          if (hadRecognitionErrorRef.current) {
            return;
          }

          const finalWords = recognizedTextRef.current.trim();
          if (finalWords.length > 0) {
            setMicState('idle');
            setMicStatusMessage(null);
            // Send the recognized question to Gemini when speech recognition succeeds
            sendMessage(finalWords);
          } else {
            // Never pretend to have heard speech when no speech was recognized
            setMicState('error');
            setMicStatusMessage(SPEECH_FAIL_MESSAGE);
          }
        };

        recognition.start();
      } catch {
        setMicState('error');
        setMicStatusMessage(SPEECH_FAIL_MESSAGE);
      }
      return;
    }

    // Fallback: If browser does not support Web SpeechRecognition, check MediaRecorder + Gemini Transcribe
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof window.MediaRecorder !== 'undefined'
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        setMicState('listening');
        setMicStatusMessage(ui.micListeningStatus);

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          setMicState('processing');
          setMicStatusMessage(ui.micProcessingStatus);

          const audioBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });

          if (audioBlob.size < 500) {
            setMicState('error');
            setMicStatusMessage(SPEECH_FAIL_MESSAGE);
            return;
          }

          try {
            const base64Audio = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const resStr = String(reader.result || '');
                const base64 = resStr.split(',')[1] || '';
                resolve(base64);
              };
              reader.onerror = reject;
              reader.readAsDataURL(audioBlob);
            });

            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64Audio,
                mimeType: recorder.mimeType || 'audio/webm',
              }),
            });

            if (!res.ok) {
              throw new Error('Transcription failed');
            }

            const data = await res.json();
            const transcript = (data.transcript || '').trim();
            if (transcript.length > 0) {
              setInputValue(transcript);
              setMicState('idle');
              setMicStatusMessage(null);
              sendMessage(transcript);
            } else {
              setMicState('error');
              setMicStatusMessage(SPEECH_FAIL_MESSAGE);
            }
          } catch {
            setMicState('error');
            setMicStatusMessage(SPEECH_FAIL_MESSAGE);
          }
        };

        recorder.start();
      } catch (err) {
        const isDenied =
          err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
        setMicState('error');
        setMicStatusMessage(isDenied ? ui.micPermissionDenied : SPEECH_FAIL_MESSAGE);
      }
      return;
    }

    // Browser supports neither SpeechRecognition nor audio recording
    setMicState('unsupported');
    setMicStatusMessage(ui.micUnsupported);
    inputRef.current?.focus();
  };

  const handleNewChat = () => {
    stopAllAudioPlayback();
    setMessages([
      {
        id: 'welcome-msg',
        role: 'assistant',
        content: WELCOME_MESSAGE,
      },
    ]);
    setInputValue('');
    setApiError(null);
    setLastFailedPrompt(null);
    setMicState('idle');
    setMicStatusMessage(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#FDFBF9] via-[#FAF4F4] to-[#F6EFF8] text-stone-800">
      {/* Minimal Header */}
      <header className="sticky top-0 z-20 bg-[#FDFBF9]/90 backdrop-blur-md border-b border-rose-200/60 px-4 sm:px-6 py-3.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          {/* App Name */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
              <Heart className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-stone-900 leading-none">
                DilSe AI
              </h1>
              <p className="text-[11px] text-stone-500 mt-1 whitespace-pre-line leading-snug">
                {ui.appSubtitle}
              </p>
            </div>
          </div>

          {/* Language Selector & Reset Chat */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              role="group"
              aria-label="Language Selector"
              className="flex items-center gap-1 p-1 bg-rose-100/70 border border-rose-200/80 rounded-lg"
            >
              {LANGUAGE_OPTIONS.map((lang) => {
                const active = selectedLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setSelectedLanguage(lang.code)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'text-stone-700 hover:text-stone-950 hover:bg-white/60'
                    }`}
                  >
                    {lang.label}
                  </button>
                );
              })}
            </div>

            {messages.length > 1 && (
              <button
                type="button"
                onClick={handleNewChat}
                title={ui.newChat}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white/90 hover:bg-white border border-rose-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-700" />
                <span className="hidden sm:inline">{ui.newChat}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Conversation Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col">
        <div className="flex-1 space-y-5 pb-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isPlaying = playingMessageId === msg.id;
            const isLoadingAudio = loadingAudioId === msg.id;

            if (isUser) {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[75%] bg-gradient-to-br from-rose-700 to-purple-800 text-white rounded-2xl rounded-tr-sm px-5 py-3.5 shadow-xs">
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[90%] sm:max-w-[82%] bg-white/95 border border-rose-200/70 rounded-2xl rounded-tl-sm px-5 py-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-rose-800">
                      DilSe AI
                    </span>

                    {/* Audio Playback Control (Play / Stop) */}
                    <button
                      type="button"
                      onClick={() => handleTogglePlayMessage(msg)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                        isPlaying
                          ? 'bg-rose-700 text-white border-rose-700'
                          : 'bg-rose-50/80 text-rose-900 border-rose-200/90 hover:bg-rose-100/80'
                      }`}
                    >
                      {isLoadingAudio ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{ui.loadingAudio}</span>
                        </>
                      ) : isPlaying ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>{ui.stopAudio}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{ui.playAudio}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[15px] text-stone-800 leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Starter Questions when only Welcome Message is visible */}
          {messages.length === 1 && !isSending && (
            <div className="pt-2 space-y-2.5">
              <p className="text-xs font-medium text-stone-500 px-1">
                {ui.starterTitle}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ui.starters.map((promptText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendMessage(promptText)}
                    className="text-left px-4 py-3 bg-white/85 hover:bg-white border border-rose-200/70 hover:border-rose-400 rounded-xl text-sm text-stone-800 transition-colors shadow-2xs"
                  >
                    “{promptText}”
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Typing / Loading Indicator */}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-white/90 border border-rose-200/70 rounded-2xl rounded-tl-sm px-5 py-3.5 flex items-center gap-2.5 text-sm text-stone-600 shadow-2xs">
                <Loader2 className="w-4 h-4 text-rose-700 animate-spin shrink-0" />
                <span>{ui.typingIndicator}</span>
              </div>
            </div>
          )}

          {/* API / Network Error Banner with Retry */}
          {apiError && (
            <div
              role="alert"
              className="p-4 bg-red-50/95 border border-red-200 rounded-xl flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2.5 text-sm text-red-900">
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                <span>{apiError}</span>
              </div>
              {lastFailedPrompt && (
                <button
                  type="button"
                  onClick={handleRetryLastFailed}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{ui.retryBtn}</span>
                </button>
              )}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Bottom Sticky Input & Voice Controls */}
      <footer className="sticky bottom-0 z-20 bg-[#FDFBF9]/95 backdrop-blur-md border-t border-rose-200/70 px-4 sm:px-6 py-3.5">
        <div className="max-w-3xl mx-auto space-y-2.5">
          {/* Microphone Status / Error Feedback */}
          {micStatusMessage && (
            <div
              role="status"
              aria-live="polite"
              className={`px-4 py-2.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-3 ${
                micState === 'listening'
                  ? 'bg-rose-50 border-rose-300 text-rose-900 font-medium'
                  : micState === 'processing'
                  ? 'bg-purple-50 border-purple-200 text-purple-900 font-medium'
                  : 'bg-amber-50/95 border-amber-200 text-stone-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {micState === 'listening' && (
                  <Mic className="w-4 h-4 text-rose-700 shrink-0" />
                )}
                {micState === 'processing' && (
                  <Loader2 className="w-4 h-4 text-purple-700 animate-spin shrink-0" />
                )}
                {(micState === 'error' || micState === 'unsupported' || micState === 'idle') && (
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                )}
                <span>{micStatusMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMicStatusMessage(null);
                  if (micState === 'error') setMicState('idle');
                }}
                className="text-xs font-medium text-stone-500 hover:text-stone-800 whitespace-nowrap shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {/* Input Bar: Microphone Button + Text Input Field + Send Button */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-end gap-2.5"
          >
            {/* Microphone Button */}
            <button
              type="button"
              onClick={handleMicToggle}
              disabled={isSending || micState === 'processing'}
              aria-label={micState === 'listening' ? ui.micStopLabel : ui.micStartLabel}
              title={micState === 'listening' ? ui.micStopLabel : ui.micStartLabel}
              className={`h-11 px-3.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                micState === 'listening'
                  ? 'bg-rose-700 text-white border-rose-700 shadow-sm'
                  : micState === 'processing'
                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                  : 'bg-white hover:bg-rose-50 text-rose-800 border-rose-200/90'
              }`}
            >
              {micState === 'listening' ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span className="hidden sm:inline">{ui.micStopLabel}</span>
                </>
              ) : micState === 'processing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">{ui.micProcessingStatus}</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span className="hidden sm:inline">{ui.micStartLabel}</span>
                </>
              )}
            </button>

            {/* Text Input */}
            <textarea
              ref={inputRef}
              rows={1}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (micStatusMessage && micState !== 'listening') {
                  setMicStatusMessage(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={ui.inputPlaceholder}
              className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl bg-white border border-rose-200/90 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-rose-500"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={isSending}
              className="h-11 px-4 sm:px-5 rounded-xl bg-gradient-to-r from-rose-700 to-purple-800 hover:from-rose-800 hover:to-purple-900 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span>{ui.sendBtn}</span>
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
