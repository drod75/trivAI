// Store audio context to enable autoplay
let audioContextEnabled = false;

async function ensureAudioContext() {
  if (audioContextEnabled) return;
  
  try {
    // Create a hidden audio element and play/pause to enable audio context
    const audio = new Audio();
    audio.volume = 0.01;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
      audio.pause();
      audioContextEnabled = true;
      console.log("✓ TTS: Audio context enabled");
    }
  } catch (err) {
    // Ignore errors - we'll try again on first user interaction
    console.log("ℹ TTS: Audio context will be enabled on first user interaction");
  }
}

export async function speak(text: string) {
  if (!text?.trim()) return;
  
  const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
  if (!apiKey || apiKey === 'REPLACE_ME') {
    console.warn("⚠ TTS: No NEXT_PUBLIC_ELEVENLABS_API_KEY set or still has placeholder value");
    console.warn("⚠ TTS: Add NEXT_PUBLIC_ELEVENLABS_API_KEY to frontend/.env.local and restart dev server");
    return;
  }
  
  const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || "RkPzsL2i3teMYv0FxEYQ6";
  
  try {
    // Ensure audio context is enabled
    await ensureAudioContext();
    
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }),
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      console.error(`❌ TTS API error (${res.status}):`, errorText);
      if (res.status === 401) {
        console.error("❌ TTS: Invalid API key. Check your NEXT_PUBLIC_ELEVENLABS_API_KEY");
      }
      return;
    }
    
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1.0;
    
    // Handle audio play promise
    try {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
        console.log("✓ TTS: Playing audio for:", text.substring(0, 50) + "...");
        audioContextEnabled = true;
      }
    } catch (playError: any) {
      // If autoplay fails, try enabling audio context and retry once
      if (playError.name === 'NotAllowedError') {
        console.log("ℹ TTS: Autoplay blocked, enabling audio context...");
        await ensureAudioContext();
        try {
          await audio.play();
          console.log("✓ TTS: Playing audio after context enable");
          audioContextEnabled = true;
        } catch (retryError) {
          console.warn("⚠ TTS: Audio play failed - user interaction required:", retryError);
          // Store for later playback on user interaction
          (window as any).__pendingTTSAudio = audio;
        }
      } else {
        console.error("❌ TTS: Audio play failed:", playError);
      }
    }
    
    // Clean up the object URL after playback
    audio.addEventListener("ended", () => {
      URL.revokeObjectURL(url);
      audioContextEnabled = true;
    }, { once: true });
    
    // Also clean up on error
    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
    }, { once: true });
  } catch (error) {
    console.error("❌ TTS fetch failed:", error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error("❌ TTS: Network error - check your internet connection");
    }
  }
}

// Enable audio context on any user interaction
if (typeof window !== 'undefined') {
  const enableAudio = async () => {
    await ensureAudioContext();
    // Try to play any pending audio
    if ((window as any).__pendingTTSAudio) {
      try {
        await (window as any).__pendingTTSAudio.play();
        delete (window as any).__pendingTTSAudio;
      } catch (e) {
        // Ignore
      }
    }
  };
  document.addEventListener('click', enableAudio, { once: true });
  document.addEventListener('touchstart', enableAudio, { once: true });
  document.addEventListener('keydown', enableAudio, { once: true });
}

