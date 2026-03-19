import { useEffect, useRef, useState } from 'react';

interface SpeechPlaybackButtonProps {
  text: string;
  label?: string;
  lang?: string;
}

export function SpeechPlaybackButton({
  text,
  label = 'Ascolta descrizione',
  lang = 'it-IT',
}: SpeechPlaybackButtonProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        typeof window.speechSynthesis?.speak === 'function',
    );

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function stopPlayback() {
    if (!isSupported) {
      return;
    }

    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  }

  function startPlayback() {
    if (!isSupported || !text.trim()) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onend = () => {
      utteranceRef.current = null;
      setIsSpeaking(false);
    };
    utterance.onerror = () => {
      utteranceRef.current = null;
      setIsSpeaking(false);
    };
    utteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  if (!isSupported) {
    return null;
  }

  return (
    <button
      type="button"
      className="button button-secondary"
      onClick={() => (isSpeaking ? stopPlayback() : startPlayback())}
      aria-label={isSpeaking ? 'Ferma lettura audio' : label}
      disabled={!text.trim()}
    >
      {isSpeaking ? 'Ferma audio' : 'Ascolta audio'}
    </button>
  );
}
