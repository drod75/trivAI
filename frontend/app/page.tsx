'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { generateQuiz, type QuizResponse, type QuizQuestion } from '@/lib/api';
import { speak } from '@/lib/tts';

type QuizState = 'form' | 'quiz' | 'results';
type Mode = 'single' | 'multiplayer';

// Timer settings by difficulty
const getTimerForDifficulty = (difficulty: 'Easy' | 'Medium' | 'Hard'): number => {
  switch (difficulty) {
    case 'Easy':
      return 15000; // 15 seconds
    case 'Medium':
      return 20000; // 20 seconds
    case 'Hard':
      return 20000; // 20 seconds
    default:
      return 20000;
  }
};

const TIME_PER_QUESTION_SECONDS = 15; // Default (for Easy)
const TIME_PER_QUESTION_MS = TIME_PER_QUESTION_SECONDS * 1000;

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [mode, setMode] = useState<Mode>('single');
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [timedOutQuestions, setTimedOutQuestions] = useState<Record<number, boolean>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizState, setQuizState] = useState<QuizState>('form');
  const [timeRemainingMs, setTimeRemainingMs] = useState(TIME_PER_QUESTION_MS);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const musicLoopRef = useRef<number | null>(null);
  const beatStepRef = useRef(0);
  const timeRemainingSeconds = Math.max(0, Math.ceil(timeRemainingMs / 1000));

  const difficultyOptions = [
    {
      value: 'Easy' as const,
      title: 'Ease In',
      subtitle: 'Start with approachable questions to warm up.',
      activeClasses:
        'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/30 ring-2 ring-emerald-300/70 dark:ring-emerald-400/60',
      inactiveClasses:
        'bg-white/80 dark:bg-white/5 border border-emerald-200/70 dark:border-emerald-500/40 shadow-sm hover:shadow-xl hover:shadow-emerald-500/25 hover:-translate-y-1',
      focusRing: 'focus-visible:ring-emerald-400/60 dark:focus-visible:ring-emerald-500/40',
      hoverGlow: 'bg-gradient-to-br from-emerald-200/40 via-transparent to-emerald-500/30 dark:from-emerald-500/20 dark:to-emerald-400/30',
    },
    {
      value: 'Medium' as const,
      title: 'Find Your Rhythm',
      subtitle: 'Keep the pace steady with thoughtful challenges.',
      activeClasses:
        'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xl shadow-amber-500/35 ring-2 ring-amber-300/70 dark:ring-amber-400/60',
      inactiveClasses:
        'bg-white/80 dark:bg-white/5 border border-amber-200/70 dark:border-amber-500/30 shadow-sm hover:shadow-xl hover:shadow-amber-500/25 hover:-translate-y-1',
      focusRing: 'focus-visible:ring-amber-400/60 dark:focus-visible:ring-amber-500/40',
      hoverGlow: 'bg-gradient-to-br from-amber-200/40 via-transparent to-amber-500/30 dark:from-amber-500/20 dark:to-amber-400/30',
    },
    {
      value: 'Hard' as const,
      title: 'Go All In',
      subtitle: 'Dive deep with brain-bending prompts.',
      activeClasses:
        'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-xl shadow-rose-500/35 ring-2 ring-rose-300/70 dark:ring-rose-400/60',
      inactiveClasses:
        'bg-white/80 dark:bg-white/5 border border-rose-200/70 dark:border-rose-500/40 shadow-sm hover:shadow-xl hover:shadow-rose-500/25 hover:-translate-y-1',
      focusRing: 'focus-visible:ring-rose-400/60 dark:focus-visible:ring-rose-500/40',
      hoverGlow: 'bg-gradient-to-br from-rose-200/40 via-transparent to-rose-500/30 dark:from-rose-500/20 dark:to-rose-400/30',
    },
  ];

  const baseDifficultyButtonClasses =
    'group relative overflow-hidden rounded-[26px] p-6 text-left transition-all duration-200 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 active:scale-[0.97]';

  const sliderFillPercent = ((numQuestions - 1) / 29) * 100;
  const questionSliderStyle = {
    '--slider-track': `linear-gradient(90deg, rgba(79,70,229,0.55) 0%, rgba(79,70,229,0.55) ${sliderFillPercent}%, rgba(148,163,184,0.35) ${sliderFillPercent}%, rgba(148,163,184,0.35) 100%)`,
  } as CSSProperties;

  const modeOptions: Array<{
    value: Mode;
    title: string;
    description: string;
  }> = [
    {
      value: 'single',
      title: 'Single Player',
      description: 'Generate a tailored quiz and play through at your own pace.',
    },
    {
      value: 'multiplayer',
      title: 'Multiplayer',
      description: 'Host a room or join friends with a code for shared trivia.',
    },
  ];

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') {
      return null;
    }

    const globalWindow = window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    };

    const AudioContextConstructor = globalWindow.AudioContext || globalWindow.webkitAudioContext;
    if (!AudioContextConstructor) {
      console.warn('Web Audio API is not supported in this browser.');
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    const context = audioContextRef.current;
    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch (err) {
        console.warn('Unable to resume audio context', err);
        return null;
      }
    }

    return context;
  }, []);

  const ensureGainNode = useCallback((context: AudioContext) => {
    if (!gainNodeRef.current) {
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.25, context.currentTime);
      gain.connect(context.destination);
      gainNodeRef.current = gain;
    }
    return gainNodeRef.current;
  }, []);

  const playBeat = useCallback(
    (context: AudioContext, accent: boolean) => {
      const masterGain = ensureGainNode(context);
      if (!masterGain) {
        return;
      }
      const oscillator = context.createOscillator();
      const envelope = context.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(accent ? 392 : 220, context.currentTime);

      envelope.gain.setValueAtTime(0, context.currentTime);
      envelope.gain.linearRampToValueAtTime(accent ? 0.38 : 0.26, context.currentTime + 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);

      oscillator.connect(envelope);
      envelope.connect(masterGain);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.4);

      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
    },
    [ensureGainNode]
  );

  const scheduleMusic = useCallback(async () => {
    const context = await ensureAudioContext();
    if (!context) {
      return;
    }

    const accent = beatStepRef.current % 4 === 0;
    playBeat(context, accent);
    beatStepRef.current += 1;

    const intervalMs = accent ? 640 : 480;
    musicLoopRef.current = window.setTimeout(() => {
      void scheduleMusic();
    }, intervalMs);
  }, [ensureAudioContext, playBeat]);

  const startMusic = useCallback(() => {
    if (musicLoopRef.current !== null) {
      return;
    }
    const context = audioContextRef.current;
    const gain = gainNodeRef.current;
    if (context && gain) {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.25, now);
    }
    beatStepRef.current = 0;
    void scheduleMusic();
  }, [scheduleMusic]);

  const stopMusic = useCallback(() => {
    if (musicLoopRef.current !== null) {
      window.clearTimeout(musicLoopRef.current);
      musicLoopRef.current = null;
    }

    const context = audioContextRef.current;
    const gain = gainNodeRef.current;
    if (context && gain) {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.0, now + 0.4);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
      stopMusic();
      if (audioContextRef.current) {
        audioContextRef.current
          .close()
          .catch(() => undefined);
        audioContextRef.current = null;
        gainNodeRef.current = null;
      }
    };
  }, [stopMusic]);

  useEffect(() => {
    if (quizState === 'quiz') {
      startMusic();
    } else {
      stopMusic();
    }
  }, [quizState, startMusic, stopMusic]);

  // TTS: Speak question when it changes
  useEffect(() => {
    if (quizState === 'quiz' && quiz && currentQuestionIndex < quiz.questions.length) {
      const currentQuestion = quiz.questions[currentQuestionIndex];
      if (currentQuestion?.question) {
        speak(currentQuestion.question);
      }
    }
  }, [currentQuestionIndex, quizState, quiz]);

  // Reset timer when question changes
  useEffect(() => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    const timerMs = getTimerForDifficulty(difficulty);
    setTimeRemainingMs(timerMs);
  }, [currentQuestionIndex, difficulty]);

  // Timer effect
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (quizState !== 'quiz') {
      return;
    }

    const answered =
      selectedAnswers[currentQuestionIndex] !== undefined ||
      timedOutQuestions[currentQuestionIndex];
    if (answered) {
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setTimeRemainingMs((prev) => {
        if (prev <= 50) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          setTimedOutQuestions((prevTimedOut) => {
            if (prevTimedOut[currentQuestionIndex]) {
              return prevTimedOut;
            }
            return { ...prevTimedOut, [currentQuestionIndex]: true };
          });
          setTimeout(() => handleNextQuestion(), 0);
          return 0;
        }
        return prev - 50;
      });
    }, 50);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [quizState, currentQuestionIndex, selectedAnswers, timedOutQuestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate topic is provided
    if (!prompt.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoading(true);
    setError(null);
    setQuiz(null);
    setSelectedAnswers({});
    setTimedOutQuestions({});
    setCurrentQuestionIndex(0);
    setQuizState('form');

    try {
      await ensureAudioContext();
      
      // Generate quiz from topic
      const result = await generateQuiz({ prompt, num_questions: numQuestions, difficulty });
      
      setQuiz(result);
      setQuizState('quiz');
      setCurrentQuestionIndex(0);
      const timerMs = getTimerForDifficulty(difficulty);
      setTimeRemainingMs(timerMs);
      setError(null);
    } catch (err) {
      console.error('Quiz generation error:', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to generate quiz. Please check your connection and try again.';
      setError(errorMessage);
      setQuizState('form'); // Stay on form if error
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (choice: string) => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }

    setTimedOutQuestions((prev) => {
      if (!prev[currentQuestionIndex]) {
        return prev;
      }
      const updated = { ...prev };
      delete updated[currentQuestionIndex];
      return updated;
    });

    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: choice,
    }));

    autoAdvanceTimeoutRef.current = setTimeout(() => {
      handleNextQuestion();
    }, 600);
  };

  const handleNextQuestion = () => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Move to results
      setQuizState('results');
    }
  };

  const handleExitQuiz = () => {
    handleStartOver();
  };

  const handleStartOver = () => {
    stopMusic();
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setQuiz(null);
    setSelectedAnswers({});
    setTimedOutQuestions({});
    setCurrentQuestionIndex(0);
    setQuizState('form');
    setError(null);
    const timerMs = getTimerForDifficulty(difficulty);
    setTimeRemainingMs(timerMs);
  };

  const calculateScore = () => {
    if (!quiz) return 0;
    let correct = 0;
    quiz.questions.forEach((q, index) => {
      if (selectedAnswers[index] === q.answer) {
        correct++;
      }
    });
    return correct;
  };

  const getCurrentQuestion = (): QuizQuestion | null => {
    if (!quiz || currentQuestionIndex >= quiz.questions.length) return null;
    return quiz.questions[currentQuestionIndex];
  };

  // Render Quiz Form
  if (quizState === 'form') {
    const primaryCard = mode === 'single' ? (
      <Card className="overflow-hidden rounded-[32px] bg-white/80 shadow-[0_50px_120px_-70px_rgba(88,28,135,0.45)] backdrop-blur-2xl dark:bg-white/10 dark:shadow-[0_50px_120px_-70px_rgba(14,116,144,0.45)]">
        <CardHeader className="border-b border-white/60 bg-gradient-to-r from-white/90 via-white/60 to-white/40 px-8 py-8 dark:border-white/5 dark:from-white/10 dark:via-white/5 dark:to-transparent">
          <CardTitle className="text-3xl font-heading text-slate-900 dark:text-white">
            Design your quiz here
          </CardTitle>
          <CardDescription className="text-base text-slate-600 dark:text-slate-300">
            Fine-tune the content, pacing, and difficulty.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8 pt-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Topic Input */}
            <div className="space-y-3">
              <label htmlFor="prompt" className="text-base font-heading uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                Topic
              </label>
              <Input
                id="prompt"
                type="text"
                placeholder="e.g., The French Revolution, Quantum Physics, World War II..."
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setError(null);
                }}
                className="h-14 rounded-2xl border border-white/60 bg-white/80 px-5 text-lg text-slate-900 shadow-sm transition focus:border-purple-400 focus:ring-4 focus:ring-purple-200/60 dark:border-white/10 dark:bg-white/10 dark:text-white dark:focus:border-purple-400"
              />
            </div>

            {/* Number of Questions */}
            <div className="space-y-5 rounded-[28px] border border-white/60 bg-gradient-to-r from-purple-50/80 via-blue-50/80 to-pink-50/70 p-7 shadow-inner dark:border-white/10 dark:from-white/10 dark:via-white/5 dark:to-white/0">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-heading uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                    Length
                  </p>
                  <h3 className="text-2xl font-heading text-slate-900 dark:text-white">Number of questions</h3>
                </div>
                <span className="rounded-2xl border border-purple-300/60 bg-white/80 px-5 py-3 text-4xl font-heading text-purple-600 shadow-md dark:border-purple-300/20 dark:bg-white/10 dark:text-purple-200">
                  {numQuestions}
                </span>
              </div>
              <input
                id="num_questions"
                type="range"
                min="1"
                max="30"
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                className="w-full accent-purple-500"
                style={questionSliderStyle}
              />
              <div className="flex justify-between text-xs font-heading tracking-[0.2em] text-slate-500 dark:text-slate-400">
                <span>1</span>
                <span>30</span>
              </div>
            </div>

            {/* Difficulty Selector */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-heading uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                  Challenge Level
                </p>
                <h3 className="mt-2 text-xl font-heading text-slate-900 dark:text-white">
                  Choose a pace that matches your current flow.
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {difficultyOptions.map((option) => {
                  const isActive = difficulty === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDifficulty(option.value)}
                      aria-pressed={isActive}
                      className={`${baseDifficultyButtonClasses} ${
                        isActive ? option.activeClasses : option.inactiveClasses
                      } ${option.focusRing}`}
                    >
                      <div className="relative z-10 space-y-2">
                        <p className="text-sm font-heading uppercase tracking-[0.18em] opacity-70">
                          {option.value}
                        </p>
                        <p className="text-xl font-heading">{option.title}</p>
                        <p
                          className={`text-sm transition-colors ${
                            isActive ? 'text-white/85' : 'text-slate-600/90 dark:text-slate-200/90'
                          }`}
                        >
                          {option.subtitle}
                        </p>
                        <span
                          className={`inline-flex items-center gap-2 text-xs font-heading uppercase tracking-[0.22em] transition-all ${
                            isActive
                              ? 'text-white/85'
                              : 'text-slate-700/70 dark:text-slate-200/70 group-hover:text-slate-900 group-hover:dark:text-white'
                          }`}
                        >
                          <span>{isActive ? 'Selected' : 'Tap to select'}</span>
                          <svg
                            className={`h-3 w-3 transition-transform duration-200 ${
                              isActive ? '' : 'group-hover:translate-x-1'
                            }`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 12h14" />
                            <path d="m13 18 6-6-6-6" />
                          </svg>
                        </span>
                      </div>
                      <div
                        className={`absolute inset-0 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 ${option.hoverGlow}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Ready when you are. trivAI will craft each question to match the tone and difficulty you’ve selected.
              </p>
                <Button
                  type="submit"
                  disabled={loading}
                  className="group w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-10 py-6 font-heading text-lg text-white shadow-[0_20px_40px_-18px_rgba(99,102,241,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_28px_50px_-20px_rgba(139,92,246,0.75)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:scale-100 md:w-auto dark:focus-visible:ring-offset-slate-950"
                >
                  {loading ? 'Preparing your quiz...' : 'Generate quiz'}
                </Button>
            </div>
          </form>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    ) : (
      <Card className="overflow-hidden rounded-[32px] bg-white/85 shadow-[0_50px_120px_-70px_rgba(79,70,229,0.45)] backdrop-blur-2xl dark:bg-white/10 dark:shadow-[0_50px_120px_-70px_rgba(56,189,248,0.45)]">
        <CardHeader className="border-b border-white/60 bg-gradient-to-r from-white/90 via-white/60 to-white/40 px-8 py-8 dark:border-white/5 dark:from-white/10 dark:via-white/5 dark:to-transparent">
          <CardTitle className="text-3xl font-heading text-slate-900 dark:text-white">Play with your crew</CardTitle>
          <CardDescription className="text-base text-slate-600 dark:text-slate-300">
            Create a live room or jump into an ongoing session—everyone answers in real time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-10 pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex h-full flex-col justify-between rounded-3xl border border-purple-200/70 bg-purple-50/70 p-6 dark:border-purple-500/30 dark:bg-purple-500/10">
              <div className="space-y-3">
                <span className="inline-flex items-center rounded-full bg-purple-200 px-3 py-1 text-xs font-heading uppercase tracking-[0.24em] text-purple-800 dark:bg-purple-500/30 dark:text-purple-200">
                  Host
                </span>
                <h3 className="text-xl font-heading text-slate-900 dark:text-white">Spin up a new room</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Generate a fresh quiz, share the join code, and guide players through each round.
                </p>
              </div>
              <Button asChild className="mt-5 rounded-2xl py-5 text-sm font-semibold uppercase tracking-[0.22em]">
                <Link href="/multiplayer?role=host">Start hosting</Link>
              </Button>
            </div>
            <div className="flex h-full flex-col justify-between rounded-3xl border border-slate-200/70 bg-white/80 p-6 dark:border-white/15 dark:bg-white/5">
              <div className="space-y-3">
                <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-heading uppercase tracking-[0.24em] text-slate-800 dark:bg-slate-500/20 dark:text-slate-200">
                  Join
                </span>
                <h3 className="text-xl font-heading text-slate-900 dark:text-white">Enter a join code</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Already have a code? Pop into the lobby and answer alongside your friends.
                </p>
              </div>
              <Button
                asChild
                variant="neutral"
                className="mt-5 rounded-2xl py-5 text-sm font-semibold uppercase tracking-[0.22em]"
              >
                <Link href="/multiplayer?role=player">Go to lobby</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200/60 bg-white/70 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            <p>
              Looking to preview the experience first? Head over to the multiplayer hub to see the live scoreboard,
              active questions, and roster updates in real time.
            </p>
          </div>
        </CardContent>
      </Card>
    );

    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#ede7ff] via-[#f3f7ff] to-[#ffe7f1] p-4 md:p-10 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-purple-300/40 blur-3xl dark:bg-purple-600/20" />
          <div className="absolute top-1/3 -right-16 h-72 w-72 rounded-full bg-blue-300/30 blur-3xl dark:bg-sky-600/20" />
          <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-pink-200/40 blur-3xl dark:bg-pink-500/10" />
        </div>

        <div className="relative mx-auto flex max-w-5xl flex-col gap-6 md:gap-12">
          {/* Hero Header */}
          <section className="rounded-[36px] border border-white/60 bg-white/75 px-6 py-10 shadow-[0_35px_90px_-60px_rgba(79,70,229,0.45)] backdrop-blur-3xl transition-shadow dark:border-white/10 dark:bg-white/5 dark:shadow-[0_35px_90px_-60px_rgba(56,189,248,0.35)] md:px-12 md:py-12">
            <div className="space-y-8 text-center">
              <span className="inline-block font-heading text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300">
                Welcome to
              </span>
              <h1 className="text-6xl font-heading tracking-tight text-slate-900 sm:text-[72px] dark:text-white">
                <span className="bg-gradient-to-r from-purple-500 via-fuchsia-500 to-blue-500 bg-clip-text text-transparent pr-1">
                  triv
                </span>
                <span>AI</span>
              </h1>
              <div className="relative mx-auto max-w-xl overflow-hidden py-1">
                <div className="marquee-track text-lg text-slate-600 dark:text-slate-300">
                  <span>Create personalized quizzes in seconds with the power of AI.</span>
                  <span aria-hidden="true">Create personalized quizzes in seconds with the power of AI.</span>
                  <span aria-hidden="true">Create personalized quizzes in seconds with the power of AI.</span>
                </div>
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {modeOptions.map((option) => {
                  const isActive = mode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value)}
                      className={`group flex h-full flex-col items-start gap-3 rounded-[28px] border bg-white/85 p-6 text-left shadow-[0_35px_90px_-60px_rgba(79,70,229,0.35)] transition-all hover:-translate-y-1 hover:shadow-[0_40px_120px_-70px_rgba(79,70,229,0.45)] dark:bg-white/10 dark:shadow-[0_40px_120px_-70px_rgba(56,189,248,0.45)] ${
                        isActive
                          ? 'border-purple-500/70 ring-2 ring-purple-400/60 dark:border-purple-400/70'
                          : 'border-white/60 dark:border-white/10'
                      }`}
                    >
                      <span className="rounded-full bg-purple-100 px-4 py-1 text-xs font-heading uppercase tracking-[0.24em] text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
                        {option.value === 'single' ? 'Solo' : 'Party'}
                      </span>
                      <div className="space-y-2">
                        <p className="text-2xl font-heading text-slate-900 dark:text-white">{option.title}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{option.description}</p>
                      </div>
                      <span
                        className={`mt-auto inline-flex items-center gap-2 text-xs font-heading uppercase tracking-[0.22em] ${
                          isActive
                            ? 'text-purple-600 dark:text-purple-200'
                            : 'text-slate-500 dark:text-slate-300'
                        }`}
                      >
                        <span>{isActive ? 'Selected' : 'Choose mode'}</span>
                        <svg
                          className={`h-3 w-3 transition-transform duration-200 ${
                            isActive ? 'translate-x-1' : 'group-hover:translate-x-1'
                          }`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12h14" />
                          <path d="m13 18 6-6-6-6" />
                        </svg>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Quiz Form */}
          {primaryCard}
        </div>
      </div>
    );
  }

  // Render Quiz Question (Kahoot-style)
  if (quizState === 'quiz' && quiz) {
    const currentQuestion = getCurrentQuestion();
    if (!currentQuestion) return null;

    const selectedAnswer = selectedAnswers[currentQuestionIndex];
    const colorClasses = [
      'bg-blue-500 hover:bg-blue-600',
      'bg-red-500 hover:bg-red-600',
      'bg-yellow-500 hover:bg-yellow-600',
      'bg-green-500 hover:bg-green-600'
    ];

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Progress Bar */}
        <div className="w-full bg-secondary-background border-b-2 border-border">
          <div className="max-w-4xl mx-auto px-4 py-2">
            <div className="flex items-center justify-between text-sm font-base mb-1">
              <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
              <div className="flex items-center gap-3">
                <span className="hidden text-sm font-base text-slate-500 dark:text-slate-300 sm:inline">
                  {quiz.quiz_title}
                </span>
                <Button
                  variant="neutral"
                  size="sm"
                  onClick={handleExitQuiz}
                  className="rounded-full border-slate-300/60 bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                >
                  Exit Quiz
                </Button>
              </div>
            </div>
            <div className="w-full bg-background rounded-full h-2 border border-border">
              <div
                className="bg-main h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Display */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-4xl space-y-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-lg font-heading ${timeRemainingSeconds <= 5 ? 'text-red-500 animate-pulse' : 'text-foreground'}`}>
                  Time Remaining: {timeRemainingSeconds}s
                </span>
                <span className="text-sm font-base text-slate-500 dark:text-slate-300">
                  {quiz.quiz_title}
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full border border-purple-300/70 bg-purple-200/40 dark:border-purple-500/40 dark:bg-purple-500/20">
                <div
                  className={`absolute inset-y-0 left-0 bg-purple-500 transition-[width] duration-100 ease-linear ${timeRemainingSeconds <= 5 ? 'animate-pulse' : ''}`}
                  style={{ width: `${Math.max(0, (timeRemainingMs / getTimerForDifficulty(difficulty)) * 100)}%` }}
                />
                <div
                  className="absolute top-1/2 h-5 w-5 -translate-y-1/2 translate-x-[-50%] rounded-full border-2 border-white bg-purple-600 shadow-lg transition-[left] duration-100 ease-linear dark:border-white/40"
                  style={{ left: `${Math.max(0, (timeRemainingMs / getTimerForDifficulty(difficulty)) * 100)}%` }}
                />
              </div>
            </div>
            {/* Question */}
            <Card className="border-4 border-border">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl md:text-4xl font-heading break-words">
                  {currentQuestion.question}
                </CardTitle>
              </CardHeader>
            </Card>

            {/* Answer Choices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentQuestion.choices.map((choice, choiceIndex) => {
                const isSelected = selectedAnswer === choice;
                return (
                  <button
                    key={choiceIndex}
                    type="button"
                    onClick={() => handleAnswerSelect(choice)}
                    disabled={!!selectedAnswer}
                    className={`
                      rounded-base border-4 border-border p-6 text-left text-lg font-base
                      transition-all duration-200 min-h-[120px] flex items-center
                      ${isSelected
                        ? `shadow-shadow scale-105 ${colorClasses[choiceIndex % colorClasses.length]} text-white`
                        : selectedAnswer
                          ? 'bg-secondary-background opacity-50 cursor-not-allowed text-foreground'
                          : `${colorClasses[choiceIndex % colorClasses.length]} hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-shadow hover:scale-[1.02] text-white`
                      }
                      disabled:cursor-not-allowed
                    `}
                  >
                    <span className="font-heading text-2xl mr-4">{String.fromCharCode(65 + choiceIndex)}.</span>
                    <span className="flex-1">{choice}</span>
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Render Results
  if (quizState === 'results' && quiz) {
    const score = calculateScore();
    const percentage = (score / quiz.questions.length) * 100;
    const isPerfect = score === quiz.questions.length;
    const isGood = percentage >= 70;
    const isPassing = percentage >= 50;

    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Results Header */}
          <Card className="border-4 border-border">
            <CardHeader className="text-center">
              <CardTitle className="text-4xl font-heading mb-4">Quiz Complete!</CardTitle>
              <div className={`text-6xl font-heading mb-4 ${isPerfect ? 'text-green-500' : isGood ? 'text-blue-500' : isPassing ? 'text-yellow-500' : 'text-red-500'}`}>
                {score} / {quiz.questions.length}
              </div>
              <CardDescription className="text-2xl">
                {percentage.toFixed(0)}% Correct
              </CardDescription>
              {isPerfect && (
                <p className="text-xl font-heading mt-4 text-green-500">Perfect Score!</p>
              )}
            </CardHeader>
          </Card>

          {/* Review Answers */}
          <Card>
            <CardHeader>
              <CardTitle>Review Your Answers</CardTitle>
              <CardDescription>See which questions you got right and wrong</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {quiz.questions.map((question: QuizQuestion, questionIndex: number) => {
                const userAnswer = selectedAnswers[questionIndex];
                const timedOut = !!timedOutQuestions[questionIndex];
                const isCorrect = !timedOut && userAnswer === question.answer;
                const statusLabel = timedOut ? 'Timed Out' : isCorrect ? 'Correct' : 'Incorrect';
                const statusColor = timedOut
                  ? 'text-amber-500'
                  : isCorrect
                    ? 'text-green-500'
                    : 'text-red-500';

                return (
                  <div key={questionIndex} className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={`text-2xl font-heading ${statusColor} w-28 shrink-0 text-right`}
                      >
                        {statusLabel}
                      </span>
                      <div className="flex-1">
                        <h3 className="text-lg font-heading mb-2">
                          Question {questionIndex + 1}: {question.question}
                        </h3>
                        <div className="space-y-2">
                          {question.choices.map((choice, choiceIndex) => {
                            const isUserAnswer = choice === userAnswer;
                            const isCorrectAnswer = choice === question.answer;

                            return (
                              <div
                                key={choiceIndex}
                                className={`rounded-base border-2 p-3 ${
                                  isCorrectAnswer
                                    ? 'border-green-500 bg-green-100 dark:bg-green-900'
                                    : isUserAnswer
                                      ? 'border-red-500 bg-red-100 dark:bg-red-900'
                                      : 'border-border bg-secondary-background'
                                }`}
                              >
                                <span className="font-heading">{String.fromCharCode(65 + choiceIndex)}. </span>
                                {choice}
                                {isCorrectAnswer && ' (Correct Answer)'}
                                {isUserAnswer && !isCorrectAnswer && ' (Your Answer)'}
                              </div>
                            );
                          })}
                          {timedOut && (
                            <p className="text-sm font-base text-amber-600 dark:text-amber-300">
                              You ran out of time before selecting an answer.
                            </p>
                          )}
                          {!timedOut && userAnswer === undefined && (
                            <p className="text-sm font-base text-slate-600 dark:text-slate-300">
                              No answer was selected.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button onClick={handleStartOver} variant="neutral" size="lg">
              Start New Quiz
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
