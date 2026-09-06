'use client';
import { useEffect, useRef, useState } from 'react';

type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
};
function release(recognition: Recognition | null) {
  if (!recognition) return;
  recognition.onresult = null; recognition.onerror = null; recognition.onend = null;
  try { recognition.stop(); } catch { /* Already stopped. */ }
}
export function useZipSpeech() {
  const recognition = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  useEffect(() => () => { release(recognition.current); window.speechSynthesis?.cancel(); }, []);
  function stop() { release(recognition.current); recognition.current = null; setListening(false); }
  function capture(onText: (text: string) => void, language: string) {
    if (recognition.current) return;
    window.speechSynthesis?.cancel(); setSpeechError('');
    const browser = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) { setSpeechError('Voice input is not supported here. You can type every answer.'); return; }
    try {
      const instance = new Constructor(); instance.continuous = false; instance.interimResults = true; instance.lang = language;
      instance.onresult = (event) => { if (recognition.current !== instance) return; const parts: string[] = []; for (let i = 0; i < event.results.length; i++) parts.push(event.results[i][0].transcript); onText(parts.join(' ').trim()); };
      instance.onend = () => { if (recognition.current !== instance) return; recognition.current = null; setListening(false); };
      instance.onerror = () => { if (recognition.current !== instance) return; release(instance); recognition.current = null; setListening(false); setSpeechError('Voice capture stopped. Your text is still editable; type or try again.'); };
      recognition.current = instance; setListening(true); instance.start();
    } catch { release(recognition.current); recognition.current = null; setListening(false); setSpeechError('The microphone could not start. Please type your answer.'); }
  }
  function speak(text: string) {
    stop(); setSpeechError('');
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { setSpeechError('Read-aloud is unavailable here. The full question and answer are shown on screen.'); return; }
    window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; window.speechSynthesis.speak(utterance);
  }
  return { listening, speechError, capture, stop, speak };
}
