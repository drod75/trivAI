'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { speak } from '@/lib/tts';
import {
  QuizResponse,
  RoomStateResponse,
  createMultiplayerRoom,
  joinMultiplayerRoom,
  fetchRoomState,
  startMultiplayerRoom,
  advanceMultiplayerRoom,
  submitMultiplayerAnswer,
} from '@/lib/api';

type ViewRole = 'chooser' | 'host' | 'player';

interface HostSession {
  hostName: string;
  hostId: string;
  roomCode: string;
  quiz: QuizResponse;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

interface PlayerSession {
  playerName: string;
  playerId: string;
  roomCode: string;
}

const difficultyOptions: Array<'Easy' | 'Medium' | 'Hard'> = ['Easy', 'Medium', 'Hard'];

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

const roleOptions: Array<{
  value: Exclude<ViewRole, 'chooser'>;
  badge: string;
  title: string;
  description: string;
}> = [
  {
    value: 'host',
    badge: 'Host',
    title: 'Lead the game',
    description: 'Generate a quiz, share the code, and move the group through each round.',
  },
  {
    value: 'player',
    badge: 'Join',
    title: 'Play along',
    description: 'Enter a code from your host and compete on the live leaderboard.',
  },
];

function useRoomPolling(roomCode: string | null, isActive: boolean, onState: (state: RoomStateResponse) => void, onError: (message: string) => void) {
  useEffect(() => {
    if (!roomCode || !isActive) {
      return;
    }

    let cancelled = false;

    const fetchState = async () => {
      try {
        const state = await fetchRoomState(roomCode);
        if (!cancelled) {
          onState(state);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to fetch room state.';
          onError(message);
        }
      }
    };

    fetchState();
    const intervalId = setInterval(fetchState, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [roomCode, isActive, onState, onError]);
}

function MultiplayerPageContent() {
  const [role, setRole] = useState<ViewRole>('chooser');

  // Host state
  const [hostName, setHostName] = useState('');
  const [hostPrompt, setHostPrompt] = useState('');
  const [hostNumQuestions, setHostNumQuestions] = useState(5);
  const [hostDifficulty, setHostDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [hostSession, setHostSession] = useState<HostSession | null>(null);
  const [hostRoomState, setHostRoomState] = useState<RoomStateResponse | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);
  const [hostLoading, setHostLoading] = useState(false);
  const [hostActionLoading, setHostActionLoading] = useState(false);

  // Player state
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [playerRoomCodeInput, setPlayerRoomCodeInput] = useState('');
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null);
  const [playerRoomState, setPlayerRoomState] = useState<RoomStateResponse | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerAnswerLoading, setPlayerAnswerLoading] = useState(false);

  // Timer state for host and player
  const [hostTimeRemainingMs, setHostTimeRemainingMs] = useState(0);
  const [playerTimeRemainingMs, setPlayerTimeRemainingMs] = useState(0);
  const hostTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hostAutoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQuestionIndexRef = useRef<number | null>(null);
  const playerLastQuestionIndexRef = useRef<number | null>(null);
  
  // State for question reading delay (5 seconds before showing options)
  const [showOptions, setShowOptions] = useState(false);
  const [questionReadDelay, setQuestionReadDelay] = useState(0);
  const questionReadDelayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // State for celebration animations (ascending order)
  const [revealedRanks, setRevealedRanks] = useState<Set<number>>(new Set());

  const searchParams = useSearchParams();

  useEffect(() => {
    if (role !== 'chooser') {
      return;
    }
    const requestedRole = searchParams.get('role');
    if (requestedRole === 'host' || requestedRole === 'player') {
      setRole(requestedRole);
    }
  }, [role, searchParams]);

  // Pre-fill room code from URL parameter
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl && role === 'player' && !playerSession) {
      setPlayerRoomCodeInput(codeFromUrl.toUpperCase());
    }
  }, [searchParams, role, playerSession]);

  const activeRoleTile: Exclude<ViewRole, 'chooser'> | null = role === 'chooser' ? null : role;
  const panelCardClasses =
    'overflow-hidden rounded-[32px] bg-white/85 shadow-[0_50px_120px_-70px_rgba(79,70,229,0.45)] backdrop-blur-2xl dark:bg-white/10 dark:shadow-[0_50px_120px_-70px_rgba(56,189,248,0.45)]';
  const secondaryCardClasses =
    'rounded-[28px] border border-white/60 bg-white/80 shadow-[0_40px_120px_-70px_rgba(79,70,229,0.35)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_40px_120px_-70px_rgba(56,189,248,0.35)]';

  useRoomPolling(hostSession?.roomCode ?? null, Boolean(hostSession), setHostRoomState, setHostError);

  useRoomPolling(playerSession?.roomCode ?? null, Boolean(playerSession), setPlayerRoomState, setPlayerError);

  // Host timer and auto-advance logic
  useEffect(() => {
    if (hostTimerRef.current) {
      clearInterval(hostTimerRef.current);
      hostTimerRef.current = null;
    }
    if (hostAutoAdvanceRef.current) {
      clearTimeout(hostAutoAdvanceRef.current);
      hostAutoAdvanceRef.current = null;
    }

    if (!hostSession || !hostRoomState || hostRoomState.status !== 'in_progress' || !hostRoomState.question) {
      setHostTimeRemainingMs(0);
      return;
    }

    const currentQuestionIndex = hostRoomState.current_question_index;
    if (currentQuestionIndex === null) {
      setHostTimeRemainingMs(0);
      return;
    }

    // Reset timer when question changes
    if (lastQuestionIndexRef.current !== currentQuestionIndex) {
      lastQuestionIndexRef.current = currentQuestionIndex;
      const timerMs = getTimerForDifficulty(hostSession.difficulty);
      setHostTimeRemainingMs(timerMs);
    }

    // Start countdown
    hostTimerRef.current = setInterval(() => {
      setHostTimeRemainingMs((prev) => {
        if (prev <= 50) {
          // Timer expired - auto-advance
          if (hostTimerRef.current) {
            clearInterval(hostTimerRef.current);
            hostTimerRef.current = null;
          }
          // Auto-advance when timer expires - only if game is still in progress
          if (hostSession && !hostActionLoading && hostRoomState?.status === 'in_progress') {
            // Small delay to ensure state is consistent
            setTimeout(() => {
              advanceMultiplayerRoom(hostSession.roomCode, hostSession.hostId)
                .then((state) => {
                  setHostRoomState(state);
                  setHostActionLoading(false);
                })
                .catch((error) => {
                  const message = error instanceof Error ? error.message : 'Failed to advance question.';
                  // Only show error if it's not a status issue (which is expected when game ends)
                  if (!message.includes('not in progress')) {
                    setHostError(message);
                  }
                  setHostActionLoading(false);
                });
              setHostActionLoading(true);
              setHostError(null);
            }, 100);
          }
          return 0;
        }
        return prev - 50;
      });
    }, 50);

    return () => {
      if (hostTimerRef.current) {
        clearInterval(hostTimerRef.current);
        hostTimerRef.current = null;
      }
      if (hostAutoAdvanceRef.current) {
        clearTimeout(hostAutoAdvanceRef.current);
        hostAutoAdvanceRef.current = null;
      }
    };
  }, [hostSession, hostRoomState, hostRoomState?.current_question_index, hostRoomState?.status, hostActionLoading]);

  // Player timer logic
  useEffect(() => {
    if (playerTimerRef.current) {
      clearInterval(playerTimerRef.current);
      playerTimerRef.current = null;
    }

    if (!playerSession || !playerRoomState || playerRoomState.status !== 'in_progress' || !playerRoomState.question) {
      setPlayerTimeRemainingMs(0);
      return;
    }

    const currentQuestionIndex = playerRoomState.current_question_index;
    if (currentQuestionIndex === null) {
      setPlayerTimeRemainingMs(0);
      return;
    }

    const playerSelf = playerRoomState.players.find((player) => player.player_id === playerSession.playerId);
    if (playerSelf?.has_answered_current) {
      setPlayerTimeRemainingMs(0);
      return;
    }

    // Reset timer when question changes - use difficulty from room state
    const difficulty = playerRoomState.difficulty || 'Medium';
    const timerMs = getTimerForDifficulty(difficulty);
    if (playerLastQuestionIndexRef.current !== currentQuestionIndex) {
      playerLastQuestionIndexRef.current = currentQuestionIndex;
      setPlayerTimeRemainingMs(timerMs);
    }

    // Start countdown
    playerTimerRef.current = setInterval(() => {
      setPlayerTimeRemainingMs((prev) => {
        if (prev <= 50) {
          if (playerTimerRef.current) {
            clearInterval(playerTimerRef.current);
            playerTimerRef.current = null;
          }
          return 0;
        }
        return prev - 50;
      });
    }, 50);

    return () => {
      if (playerTimerRef.current) {
        clearInterval(playerTimerRef.current);
        playerTimerRef.current = null;
      }
    };
  }, [playerSession, playerRoomState, playerRoomState?.current_question_index, playerRoomState?.status]);

  // TTS for host questions
  useEffect(() => {
    if (hostRoomState?.question?.question && hostSession) {
      speak(hostRoomState.question.question);
    }
  }, [hostRoomState?.question?.question_index, hostSession]);

  // TTS for player questions - with 10 second delay before showing options
  useEffect(() => {
    if (playerRoomState?.question?.question && playerSession) {
      setShowOptions(false);
      setQuestionReadDelay(10000); // 10 seconds
      
      // Clear any existing delay timer
      if (questionReadDelayRef.current) {
        clearInterval(questionReadDelayRef.current);
      }
      
      // Start 10 second countdown
      questionReadDelayRef.current = setInterval(() => {
        setQuestionReadDelay((prev) => {
          if (prev <= 50) {
            setShowOptions(true);
            if (questionReadDelayRef.current) {
              clearInterval(questionReadDelayRef.current);
              questionReadDelayRef.current = null;
            }
            return 0;
          }
          return prev - 50;
        });
      }, 50);
      
      // Speak question immediately
      speak(playerRoomState.question.question);
      
      return () => {
        if (questionReadDelayRef.current) {
          clearInterval(questionReadDelayRef.current);
          questionReadDelayRef.current = null;
        }
      };
    }
  }, [playerRoomState?.question?.question_index, playerSession]);
  
  // Celebration animation - reveal ranks in ascending order (3rd, 2nd, 1st)
  useEffect(() => {
    if (playerRoomState?.status === 'finished' || hostRoomState?.status === 'finished') {
      setRevealedRanks(new Set());
      const state = playerRoomState || hostRoomState;
      if (state && state.players.length >= 3) {
        // Reveal 3rd place after 0.5s
        setTimeout(() => {
          setRevealedRanks((prev) => new Set([...prev, 2]));
        }, 500);
        // Reveal 2nd place after 1.5s
        setTimeout(() => {
          setRevealedRanks((prev) => new Set([...prev, 1]));
        }, 1500);
        // Reveal 1st place after 2.5s
        setTimeout(() => {
          setRevealedRanks((prev) => new Set([...prev, 0]));
        }, 2500);
      } else {
        // If less than 3 players, reveal all immediately
        const sortedPlayers = [...(state?.players || [])].sort((a, b) => b.score - a.score);
        sortedPlayers.forEach((_, index) => {
          setTimeout(() => {
            setRevealedRanks((prev) => new Set([...prev, index]));
          }, index * 500);
        });
      }
    } else {
      setRevealedRanks(new Set());
    }
  }, [playerRoomState?.status, hostRoomState?.status]);

  const handleCreateRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hostName.trim() || !hostPrompt.trim()) {
      setHostError('Please provide a host name and topic.');
      return;
    }
    setHostLoading(true);
    setHostError(null);
    try {
      const response = await createMultiplayerRoom({
        host_name: hostName.trim(),
        prompt: hostPrompt.trim(),
        num_questions: hostNumQuestions,
        difficulty: hostDifficulty,
      });
      
      setHostSession({
        hostName: hostName.trim(),
        hostId: response.host_id,
        roomCode: response.room_code,
        quiz: response.quiz,
        difficulty: hostDifficulty,
      });
      const initialState = await fetchRoomState(response.room_code);
      setHostRoomState(initialState);
      setRole('host');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create room.';
      setHostError(message);
    } finally {
      setHostLoading(false);
    }
  };

  const handleStartRoom = async () => {
    if (!hostSession) return;
    setHostActionLoading(true);
    setHostError(null);
    try {
      const state = await startMultiplayerRoom(hostSession.roomCode, hostSession.hostId);
      setHostRoomState(state);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start the game.';
      setHostError(message);
    } finally {
      setHostActionLoading(false);
    }
  };

  const handleAdvanceRoom = async () => {
    if (!hostSession || hostActionLoading) return;
    setHostActionLoading(true);
    setHostError(null);
    try {
      const state = await advanceMultiplayerRoom(hostSession.roomCode, hostSession.hostId);
      setHostRoomState(state);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to advance question.';
      setHostError(message);
    } finally {
      setHostActionLoading(false);
    }
  };

  const handleJoinRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!playerNameInput.trim() || !playerRoomCodeInput.trim()) {
      setPlayerError('Please enter both a name and room code.');
      return;
    }
    setPlayerLoading(true);
    setPlayerError(null);
    try {
      const code = playerRoomCodeInput.trim().toUpperCase();
      const response = await joinMultiplayerRoom(code, { player_name: playerNameInput.trim() });
      setPlayerSession({
        playerName: playerNameInput.trim(),
        playerId: response.player_id,
        roomCode: response.room_code,
      });
      const initialState = await fetchRoomState(response.room_code);
      setPlayerRoomState(initialState);
      setRole('player');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join room.';
      setPlayerError(message);
    } finally {
      setPlayerLoading(false);
    }
  };

  const handleSubmitAnswer = async (choice: string) => {
    if (!playerSession || !playerRoomState || playerRoomState.status !== 'in_progress') {
      return;
    }
    const alreadyAnswered = playerRoomState.players.some(
      (player) => player.player_id === playerSession.playerId && player.has_answered_current,
    );
    if (alreadyAnswered) {
      return;
    }
    setPlayerAnswerLoading(true);
    setPlayerError(null);
    try {
      const state = await submitMultiplayerAnswer(playerSession.roomCode, playerSession.playerId, choice);
      setPlayerRoomState(state);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit answer.';
      setPlayerError(message);
    } finally {
      setPlayerAnswerLoading(false);
    }
  };

  const renderScoreboard = (state: RoomStateResponse | null) => {
    if (!state) return null;
    const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
    const isFinished = state.status === 'finished';
    
    // Medal colors for top 3 with enhanced backgrounds
    const getRankStyle = (index: number, isRevealed: boolean) => {
      if (!isRevealed && isFinished && index < 3) {
        return 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500 border-slate-400 opacity-50 scale-95';
      }
      if (index === 0) {
        return 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 text-white border-yellow-600 shadow-2xl shadow-yellow-500/70 transform border-flame-animate';
      } else if (index === 1) {
        return 'bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 text-white border-gray-500 shadow-xl shadow-gray-400/60 border-stars-animate';
      } else if (index === 2) {
        return 'bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 text-white border-amber-700 shadow-xl shadow-amber-600/60';
      }
      return 'bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200 dark:from-purple-950/50 dark:via-purple-900/30 dark:to-purple-800/30 border-purple-300 dark:border-purple-700 shadow-md';
    };

    const getRankIcon = (index: number) => {
      if (index === 0) return '🥇';
      if (index === 1) return '🥈';
      if (index === 2) return '🥉';
      return `${index + 1}.`;
    };

    return (
      <Card className={`${secondaryCardClasses} ${isFinished ? 'ring-4 ring-yellow-400/70 shadow-2xl' : ''}`}>
        <CardHeader className="text-center relative overflow-hidden">
          {isFinished && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Confetti effect */}
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full animate-ping"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    backgroundColor: ['#fbbf24', '#f59e0b', '#f97316', '#ef4444', '#ec4899'][Math.floor(Math.random() * 5)],
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${1 + Math.random() * 2}s`,
                  }}
                />
              ))}
            </div>
          )}
          <CardTitle className={`text-3xl md:text-4xl font-heading bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-500 bg-clip-text text-transparent relative z-10 ${isFinished ? 'animate-pulse' : ''}`}>
            {isFinished ? '🏆 Final Scores 🏆' : 'Leaderboard'}
          </CardTitle>
          <CardDescription className="text-base relative z-10">
            {isFinished ? 'The competition is over!' : 'Track progress for everyone in the room.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedPlayers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-lg text-slate-600 dark:text-slate-300">No players yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPlayers.map((player, index) => {
                const isTopThree = index < 3;
                const isRevealed = isFinished ? (revealedRanks.has(index) || index >= 3) : true;
                const rankStyle = getRankStyle(index, isRevealed);
                const rankIcon = getRankIcon(index);
                const hasAnswered = player.has_answered_current;
                const isWinner = isFinished && index === 0 && isRevealed;
                
                return (
                  <div
                    key={player.player_id}
                    className={`
                      relative overflow-hidden rounded-2xl border-4 p-6 transition-all duration-700 ease-out
                      ${rankStyle}
                      ${isWinner ? 'scale-110 shadow-2xl ring-4 ring-yellow-300/50' : ''}
                      ${isTopThree && isFinished && isRevealed ? 'animate-bounce' : ''}
                      ${!isTopThree ? 'hover:scale-105 hover:shadow-xl' : 'hover:scale-110'}
                      ${!isRevealed && isFinished ? 'pointer-events-none' : ''}
                    `}
                    style={{
                      animationDelay: isFinished && isTopThree && isRevealed ? `${index * 0.15}s` : '0s',
                      animationIterationCount: isFinished && isTopThree && isRevealed ? 'infinite' : '1',
                      transform: !isRevealed && isFinished ? 'translateY(-20px) scale(0.9)' : undefined,
                    }}
                  >
                    {/* Celebration confetti for winner */}
                    {isWinner && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {[...Array(30)].map((_, i) => (
                          <div
                            key={i}
                            className="absolute w-3 h-3 rounded-full animate-ping"
                            style={{
                              left: `${Math.random() * 100}%`,
                              top: `${Math.random() * 100}%`,
                              backgroundColor: ['#fbbf24', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7'][Math.floor(Math.random() * 6)],
                              animationDelay: `${Math.random() * 3}s`,
                              animationDuration: `${0.5 + Math.random() * 1.5}s`,
                            }}
                          />
                        ))}
                        {/* Sparkle effects */}
                        {[...Array(15)].map((_, i) => (
                          <div
                            key={`sparkle-${i}`}
                            className="absolute text-2xl animate-pulse"
                            style={{
                              left: `${Math.random() * 100}%`,
                              top: `${Math.random() * 100}%`,
                              animationDelay: `${Math.random() * 2}s`,
                            }}
                          >
                            ⭐
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Celebration particles for top 3 when finished */}
                    {isFinished && isTopThree && !isWinner && (
                      <div className="absolute inset-0 pointer-events-none">
                        {[...Array(8)].map((_, i) => (
                          <div
                            key={i}
                            className="absolute w-2 h-2 bg-yellow-300 rounded-full animate-ping"
                            style={{
                              left: `${20 + (i * 10)}%`,
                              top: `${20 + (i % 3) * 30}%`,
                              animationDelay: `${i * 0.2}s`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                    
                    <div className="relative flex items-center justify-between z-10">
                      <div className="flex items-center gap-4">
                        <span className={`text-4xl font-bold min-w-[70px] text-center ${isWinner ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
                          {rankIcon}
                        </span>
                        <div>
                          <h3 className={`text-2xl font-heading ${isTopThree ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                            {player.name}
                            {isWinner && <span className="ml-2 text-3xl animate-bounce inline-block">👑</span>}
                          </h3>
                          {state.status === 'in_progress' && (
                            <div className="flex items-center gap-2 mt-1">
                              {hasAnswered ? (
                                <span className="text-xs font-semibold bg-emerald-500/40 text-white px-3 py-1 rounded-full animate-pulse">
                                  ✓ Answered
                                </span>
                              ) : (
                                <span className="text-xs font-semibold bg-slate-400/30 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-full">
                                  ⏳ Waiting
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-4xl md:text-5xl font-bold ${isTopThree ? 'text-white' : 'text-purple-600 dark:text-purple-400'} ${isWinner ? 'animate-pulse' : ''}`}>
                          {player.score}
                        </div>
                        <div className={`text-sm font-semibold ${isTopThree ? 'text-white/90' : 'text-slate-600 dark:text-slate-400'}`}>
                          {player.score === 1 ? 'point' : 'points'}
                        </div>
                        {isWinner && (
                          <div className="mt-2 text-xs font-bold text-yellow-200 animate-pulse">
                            CHAMPION! 🏆
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Progress bar for score visualization */}
                    {sortedPlayers.length > 0 && sortedPlayers[0].score > 0 && (
                      <div className="mt-4 h-3 bg-white/30 rounded-full overflow-hidden shadow-inner">
                        <div
                          className={`h-full transition-all duration-1000 ease-out ${
                            index === 0 ? 'bg-yellow-200 shadow-lg' :
                            index === 1 ? 'bg-gray-200' :
                            index === 2 ? 'bg-amber-500' :
                            'bg-purple-300'
                          }`}
                          style={{
                            width: `${Math.max(10, (player.score / Math.max(1, sortedPlayers[0].score)) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {isFinished && sortedPlayers.length > 0 && revealedRanks.has(0) && (
            <div className="mt-8 text-center space-y-4 animate-fade-in">
              <div className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-br from-yellow-500 via-yellow-600 to-orange-600 rounded-2xl text-white shadow-2xl animate-pulse transform hover:scale-105 transition-transform border-4 border-yellow-300 border-flame-animate">
                <span className="text-4xl animate-bounce">🎉</span>
                <span 
                  className="text-3xl font-bold"
                  style={{ 
                    fontFamily: '"Times New Roman", Times, serif',
                    color: '#1a1a1a',
                    textShadow: '2px 2px 4px rgba(255, 255, 255, 0.8)',
                  }}
                >
                  {sortedPlayers[0].name} Wins!
                </span>
                <span className="text-4xl animate-bounce" style={{ animationDelay: '0.2s' }}>🎉</span>
              </div>
              <div className="flex justify-center gap-2 text-4xl">
                <span className="animate-bounce" style={{ animationDelay: '0s' }}>🎊</span>
                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>🎊</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🎊</span>
                <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>🎊</span>
                <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>🎊</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderHostView = () => {
    if (!hostSession || !hostRoomState) {
      return null;
    }

    const currentQuestion =
      hostRoomState.question && hostSession.quiz.questions[hostRoomState.question.question_index];
    const totalPlayers = hostRoomState.players.length;
    const answeredPlayers = hostRoomState.players.filter((player) => player.has_answered_current).length;
    const isLastQuestion =
      hostRoomState.current_question_index !== null &&
      hostRoomState.current_question_index >= hostRoomState.question_count - 1;

    return (
      <div className="space-y-6">
        <Card className={secondaryCardClasses}>
          <CardHeader>
            <CardTitle>Room Lobby</CardTitle>
            <CardDescription>Share the join code so players can hop in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-slate-600 dark:text-slate-300">Join Code</p>
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-purple-100 px-4 py-2 text-2xl font-bold tracking-widest text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
                      {hostSession.roomCode}
                    </span>
                    <Button
                      type="button"
                      variant="neutral"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(hostSession.roomCode);
                        } catch {
                          // ignore clipboard errors
                        }
                      }}
                    >
                      Copy code
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-slate-600 dark:text-slate-300">Join URL</p>
                  <Button
                    type="button"
                    variant="neutral"
                    onClick={async () => {
                      try {
                        const joinUrl = typeof window !== 'undefined' 
                          ? `${window.location.origin}/multiplayer?role=player&code=${hostSession.roomCode}`
                          : '';
                        await navigator.clipboard.writeText(joinUrl);
                      } catch {
                        // ignore clipboard errors
                      }
                    }}
                  >
                    Copy join link
                  </Button>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Scan to Join</p>
                <div className="rounded-2xl border-4 border-purple-200 bg-white p-4 shadow-lg dark:border-purple-500/30 dark:bg-slate-800">
                  <QRCodeSVG
                    value={typeof window !== 'undefined' 
                      ? `${window.location.origin}/multiplayer?role=player&code=${hostSession.roomCode}`
                      : ''}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-[200px]">
                  Players can scan this code to join the room
                </p>
              </div>
            </div>
            <div>
              <p className="font-semibold text-lg">{hostSession.quiz.quiz_title}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {hostSession.quiz.questions.length} questions · Difficulty {hostSession.difficulty}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span>Status: <strong className="text-slate-900 dark:text-white">{hostRoomState.status.replace('_', ' ')}</strong></span>
              <span>Total players: <strong className="text-slate-900 dark:text-white">{totalPlayers}</strong></span>
              {hostRoomState.status === 'in_progress' && (
                <span>
                  Answered: <strong className="text-slate-900 dark:text-white">{answeredPlayers}</strong>
                </span>
              )}
            </div>

            {hostError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {hostError}
              </div>
            )}

            {hostRoomState.status === 'waiting' && (
              <Button
                type="button"
                onClick={handleStartRoom}
                disabled={hostActionLoading || totalPlayers === 0}
              >
                {hostActionLoading ? 'Starting…' : 'Start Game'}
              </Button>
            )}

            {hostRoomState.status === 'in_progress' && hostRoomState.question && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-lg font-heading ${Math.ceil(hostTimeRemainingMs / 1000) <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                    Time Remaining: {Math.max(0, Math.ceil(hostTimeRemainingMs / 1000))}s
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full border border-purple-300/70 bg-purple-200/40 dark:border-purple-500/40 dark:bg-purple-500/20">
                  <div
                    className={`absolute inset-y-0 left-0 bg-purple-500 transition-[width] duration-100 ease-linear ${Math.ceil(hostTimeRemainingMs / 1000) <= 5 ? 'animate-pulse' : ''}`}
                    style={{ width: `${Math.max(0, (hostTimeRemainingMs / getTimerForDifficulty(hostSession.difficulty)) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Questions will automatically advance when time expires
                </p>
              </div>
            )}

            {hostRoomState.status === 'finished' && (
              <div className="text-center py-4">
                <p className="text-lg font-heading text-emerald-600 dark:text-emerald-400">
                  🎉 Quiz Complete! 🎉
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  Check the scoreboard below to see the final results
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {hostRoomState.question && currentQuestion && hostRoomState.status === 'in_progress' && (
          <Card className={secondaryCardClasses}>
            <CardHeader>
              <CardTitle>
                Question {hostRoomState.question.question_number} of {hostRoomState.question.total_questions}
              </CardTitle>
              <CardDescription>This is what players currently see.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg font-semibold">{hostRoomState.question.question}</p>
              <div className="grid gap-3">
                {hostRoomState.question.choices.map((choice) => {
                  const isCorrect = currentQuestion.answer === choice;
                  return (
                    <div
                      key={choice}
                      className={`rounded-lg border px-4 py-3 ${
                        isCorrect ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className="font-medium">{choice}</span>
                      {isCorrect && (
                        <span className="ml-2 text-sm text-emerald-600 dark:text-emerald-300">(Correct answer)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {renderScoreboard(hostRoomState)}
      </div>
    );
  };

  const renderPlayerView = () => {
    if (!playerSession || !playerRoomState) {
      return null;
    }

    const currentQuestion = playerRoomState.question;
    const playerSelf = playerRoomState.players.find((player) => player.player_id === playerSession.playerId);
    const hasAnswered = Boolean(playerSelf?.has_answered_current);

    // Waiting state
    if (playerRoomState.status === 'waiting') {
      return (
        <div className="space-y-6">
          <Card className={secondaryCardClasses}>
            <CardHeader>
              <CardTitle>Welcome, {playerSession.playerName}</CardTitle>
              <CardDescription>Room {playerSession.roomCode}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Status: <strong className="text-slate-900 dark:text-white">Waiting</strong>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Waiting for the host to start the game. Keep this window open!
              </p>
              {playerError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {playerError}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    // Finished state
    if (playerRoomState.status === 'finished') {
      return (
        <div className="space-y-6">
          {renderScoreboard(playerRoomState)}
        </div>
      );
    }

    // In progress - flashcard style (full screen)
    if (currentQuestion && playerRoomState.status === 'in_progress') {
      const timeRemainingSeconds = Math.max(0, Math.ceil(playerTimeRemainingMs / 1000));
      const readDelaySeconds = Math.max(0, Math.ceil(questionReadDelay / 1000));
      const colorClasses = [
        'bg-blue-500 hover:bg-blue-600',
        'bg-red-500 hover:bg-red-600',
        'bg-yellow-500 hover:bg-yellow-600',
        'bg-green-500 hover:bg-green-600'
      ];

      return (
        <div className="fixed inset-0 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-900 dark:to-purple-950 flex flex-col overflow-hidden">
          {/* Progress Bar - Fixed at top */}
          <div className="w-full bg-white/90 dark:bg-slate-800/90 border-b-2 border-purple-200 dark:border-purple-800 shadow-sm z-10">
            <div className="w-full px-4 py-3">
              <div className="flex items-center justify-between text-sm font-base mb-2">
                <span className="font-semibold">Question {currentQuestion.question_number} of {currentQuestion.total_questions}</span>
                <span className="text-sm font-base text-slate-500 dark:text-slate-300">
                  {playerRoomState.quiz_title}
                </span>
              </div>
              <div className="w-full bg-purple-100 dark:bg-purple-900/50 rounded-full h-3 border border-purple-300 dark:border-purple-700">
                <div
                  className="bg-purple-600 dark:bg-purple-400 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestion.question_number) / currentQuestion.total_questions) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Question Display - Full screen centered */}
          <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-y-auto">
            <div className="w-full max-w-6xl space-y-8">
              {/* Timer and Reading Delay - Show question during preparation */}
              {!showOptions && readDelaySeconds > 0 && (
                <div className="text-center space-y-8">
                  <div className="space-y-4">
                    <p className="text-2xl md:text-3xl font-heading text-slate-700 dark:text-slate-300 mb-6">
                      Prepare yourself...
                    </p>
                    {/* Question Card */}
                    <Card className="border-4 border-purple-300 dark:border-purple-700 shadow-2xl bg-white/95 dark:bg-slate-800/95">
                      <CardHeader className="text-center p-8 md:p-12">
                        <CardTitle className="text-3xl md:text-4xl lg:text-5xl font-heading break-words text-slate-900 dark:text-white">
                          {currentQuestion.question}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </div>
                  <div className="space-y-4">
                    <div className="text-6xl md:text-8xl font-bold text-purple-600 dark:text-purple-400 animate-pulse">
                      {readDelaySeconds}
                    </div>
                    <p className="text-xl md:text-2xl font-heading text-slate-700 dark:text-slate-300">
                      Options will appear in {readDelaySeconds} second{readDelaySeconds !== 1 ? 's' : ''}...
                    </p>
                  </div>
                </div>
              )}
              
              {showOptions && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-xl md:text-2xl font-heading ${timeRemainingSeconds <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                        Time Remaining: {timeRemainingSeconds}s
                      </span>
                    </div>
                    <div className="relative h-4 w-full overflow-hidden rounded-full border-2 border-purple-300 dark:border-purple-700 bg-purple-100 dark:bg-purple-900/50">
                      <div
                        className={`absolute inset-y-0 left-0 bg-purple-600 dark:bg-purple-400 transition-[width] duration-100 ease-linear ${timeRemainingSeconds <= 5 ? 'animate-pulse' : ''}`}
                        style={{ width: `${Math.max(0, playerRoomState.difficulty ? (playerTimeRemainingMs / getTimerForDifficulty(playerRoomState.difficulty)) * 100 : 0)}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Question */}
                  <Card className="border-4 border-purple-300 dark:border-purple-700 shadow-2xl">
                    <CardHeader className="text-center p-8 md:p-12">
                      <CardTitle className="text-4xl md:text-5xl lg:text-6xl font-heading break-words text-slate-900 dark:text-white">
                        {currentQuestion.question}
                      </CardTitle>
                    </CardHeader>
                  </Card>

                  {/* Answer Choices - Full width grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {currentQuestion.choices.map((choice, choiceIndex) => {
                      return (
                        <button
                          key={choiceIndex}
                          type="button"
                          onClick={() => handleSubmitAnswer(choice)}
                          disabled={hasAnswered || playerAnswerLoading}
                          className={`
                            rounded-2xl border-4 border-slate-300 dark:border-slate-700 p-8 text-left text-xl md:text-2xl font-base
                            transition-all duration-200 min-h-[150px] md:min-h-[180px] flex items-center
                            shadow-lg hover:shadow-2xl
                            ${hasAnswered
                              ? 'bg-slate-200 dark:bg-slate-700 opacity-50 cursor-not-allowed text-slate-600 dark:text-slate-400'
                              : `${colorClasses[choiceIndex % colorClasses.length]} hover:scale-105 text-white cursor-pointer`
                            }
                            disabled:cursor-not-allowed
                          `}
                        >
                          <span className="font-heading text-3xl md:text-4xl mr-6">{String.fromCharCode(65 + choiceIndex)}.</span>
                          <span className="flex-1 font-semibold">{choice}</span>
                        </button>
                      );
                    })}
                  </div>

                  {hasAnswered && (
                    <div className="text-center">
                      <p className="text-2xl md:text-3xl font-heading text-emerald-600 dark:text-emerald-400 animate-pulse">
                        ✓ Answer received! Waiting for next question...
                      </p>
                    </div>
                  )}

                  {playerError && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                      {playerError}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // Hide main UI when game is in progress (for full screen experience)
  const isGameInProgress = (hostRoomState?.status === 'in_progress') || (playerRoomState?.status === 'in_progress');
  
  // If game is in progress and we're showing player view, return early (handled in renderPlayerView)
  // This ensures full screen experience without navigation
  if (isGameInProgress && playerSession && playerRoomState?.status === 'in_progress') {
    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-900 dark:to-purple-950">
        {renderPlayerView()}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#ede7ff] via-[#f3f7ff] to-[#ffe7f1] p-4 md:p-10 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-purple-300/40 blur-3xl dark:bg-purple-600/20" />
        <div className="absolute top-1/3 -right-16 h-72 w-72 rounded-full bg-blue-300/30 blur-3xl dark:bg-sky-600/20" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-pink-200/40 blur-3xl dark:bg-pink-500/10" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 md:gap-12">
        {/* Hide hero section when game is active */}
        {!isGameInProgress && (
        <section className="rounded-[36px] border border-white/60 bg-white/75 px-6 py-10 shadow-[0_35px_90px_-60px_rgba(79,70,229,0.45)] backdrop-blur-3xl transition-shadow dark:border-white/10 dark:bg-white/5 dark:shadow-[0_35px_90px_-60px_rgba(56,189,248,0.35)] md:px-12 md:py-12">
          <div className="space-y-8 text-center">
            <span className="inline-block font-heading text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300">
              Squad up
            </span>
            <h1 className="text-5xl font-heading tracking-tight text-slate-900 sm:text-[64px] dark:text-white">
              Multiplayer Lounge
            </h1>
            <div className="relative mx-auto max-w-2xl overflow-hidden py-1">
              <div className="marquee-track text-lg text-slate-600 dark:text-slate-300">
                <span>Coordinate questions live, celebrate streaks, and crown a trivia champion.</span>
                <span aria-hidden="true">Coordinate questions live, celebrate streaks, and crown a trivia champion.</span>
                <span aria-hidden="true">Coordinate questions live, celebrate streaks, and crown a trivia champion.</span>
              </div>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {roleOptions.map((option) => {
                const isActive = activeRoleTile === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={`group flex h-full flex-col items-start gap-3 rounded-[28px] border bg-white/85 p-6 text-left shadow-[0_35px_90px_-60px_rgba(79,70,229,0.35)] transition-all hover:-translate-y-1 hover:shadow-[0_40px_120px_-70px_rgba(79,70,229,0.45)] dark:bg-white/10 dark:shadow-[0_40px_120px_-70px_rgba(56,189,248,0.45)] ${
                      isActive
                        ? 'border-purple-500/70 ring-2 ring-purple-400/60 dark:border-purple-400/70'
                        : 'border-white/60 dark:border-white/10'
                    }`}
                  >
                    <span className="rounded-full bg-purple-100 px-4 py-1 text-xs font-heading uppercase tracking-[0.24em] text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
                      {option.badge}
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
                      <span>{isActive ? 'Selected' : 'Choose flow'}</span>
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
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Prefer solo play?{' '}
              <Link href="/" className="font-semibold text-purple-600 underline-offset-4 hover:underline dark:text-purple-400">
                Generate a single-player quiz instead.
              </Link>
            </div>
          </div>
        </section>
        )}

        <div className="space-y-6 md:space-y-8">
          {/* Hide chooser when game is active */}
          {role === 'chooser' && !hostSession && !playerSession && (
            <Card className={panelCardClasses}>
              <CardHeader className="border-b border-white/60 bg-gradient-to-r from-white/90 via-white/60 to-white/40 px-8 py-8 dark:border-white/5 dark:from-white/10 dark:via-white/5 dark:to-transparent">
                <CardTitle className="text-3xl font-heading text-slate-900 dark:text-white">
                  How do you want to play?
                </CardTitle>
                <CardDescription className="text-base text-slate-600 dark:text-slate-300">
                  Pick a side to see the right controls—hosts create rooms, players jump in with a shared code.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 px-8 pb-10 pt-6 md:grid-cols-2">
                {roleOptions.map((option) => (
                  <div
                    key={option.value}
                    className="flex h-full flex-col justify-between rounded-3xl border border-white/60 bg-white/80 p-6 text-left shadow-inner transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="space-y-3">
                      <span className="inline-flex items-center rounded-full bg-purple-200 px-3 py-1 text-xs font-heading uppercase tracking-[0.24em] text-purple-800 dark:bg-purple-500/30 dark:text-purple-200">
                        {option.badge}
                      </span>
                      <h3 className="text-xl font-heading text-slate-900 dark:text-white">{option.title}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{option.description}</p>
                    </div>
                    <Button
                      onClick={() => setRole(option.value)}
                      variant={option.value === 'host' ? 'default' : 'neutral'}
                      className="mt-5 rounded-2xl py-5 text-sm font-semibold uppercase tracking-[0.22em]"
                    >
                      {option.value === 'host' ? 'Start hosting' : 'Enter room'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

        {role === 'host' && !hostSession && (
          <Card className={panelCardClasses}>
            <CardHeader className="border-b border-white/60 bg-gradient-to-r from-white/90 via-white/60 to-white/40 px-8 py-8 dark:border-white/5 dark:from-white/10 dark:via-white/5 dark:to-transparent">
              <CardTitle className="text-3xl font-heading text-slate-900 dark:text-white">Create a Room</CardTitle>
              <CardDescription className="text-base text-slate-600 dark:text-slate-300">
                Generate a tailored quiz and share the join code with your players.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-8 pb-10 pt-6">
              <form onSubmit={handleCreateRoom} className="space-y-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label
                      htmlFor="host-name"
                      className="text-sm font-heading uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300"
                    >
                      Host name
                    </label>
                    <Input
                      id="host-name"
                      value={hostName}
                      onChange={(event) => setHostName(event.target.value)}
                      placeholder="e.g., Quiz Master"
                      required
                      className="h-12 rounded-2xl border border-white/60 bg-white/80 px-4 text-slate-900 shadow-sm transition focus:border-purple-400 focus:ring-4 focus:ring-purple-200/60 dark:border-white/10 dark:bg-white/10 dark:text-white dark:focus:border-purple-400"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label
                      htmlFor="host-topic"
                      className="text-sm font-heading uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300"
                    >
                      Quiz topic
                    </label>
                    <Input
                      id="host-topic"
                      value={hostPrompt}
                      onChange={(event) => setHostPrompt(event.target.value)}
                      placeholder="e.g., Solar System"
                      className="h-12 rounded-2xl border border-white/60 bg-white/80 px-4 text-slate-900 shadow-sm transition focus:border-purple-400 focus:ring-4 focus:ring-purple-200/60 dark:border-white/10 dark:bg-white/10 dark:text-white dark:focus:border-purple-400"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label
                      htmlFor="host-questions"
                      className="text-sm font-heading uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300"
                    >
                      Number of questions
                    </label>
                    <div className="relative">
                      <Input
                        id="host-questions"
                        type="number"
                        min={1}
                        max={30}
                        value={hostNumQuestions}
                        onChange={(event) => setHostNumQuestions(Number(event.target.value))}
                        className="h-12 rounded-2xl border border-white/60 bg-white/80 px-4 pr-12 text-slate-900 shadow-sm transition focus:border-purple-400 focus:ring-4 focus:ring-purple-200/60 dark:border-white/10 dark:bg-white/10 dark:text-white dark:focus:border-purple-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => setHostNumQuestions(Math.min(30, hostNumQuestions + 1))}
                          className="h-4 w-4 flex items-center justify-center text-xs text-slate-600 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 transition-colors"
                          aria-label="Increase number of questions"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 15l-6-6-6 6"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setHostNumQuestions(Math.max(1, hostNumQuestions - 1))}
                          className="h-4 w-4 flex items-center justify-center text-xs text-slate-600 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 transition-colors"
                          aria-label="Decrease number of questions"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 9l6 6 6-6"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="host-difficulty"
                      className="text-sm font-heading uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300"
                    >
                      Difficulty
                    </label>
                    <select
                      id="host-difficulty"
                      className="w-full h-12 rounded-2xl border border-white/60 bg-white/80 px-4 text-sm text-slate-900 shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-4 focus:ring-purple-200/60 dark:border-white/10 dark:bg-white/10 dark:text-white dark:focus:border-purple-400 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23334155%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%27')] bg-no-repeat bg-right-3 bg-[length:12px_12px] pr-10"
                      value={hostDifficulty}
                      onChange={(event) => setHostDifficulty(event.target.value as typeof hostDifficulty)}
                    >
                      {difficultyOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {hostError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    {hostError}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={hostLoading}
                  className="w-full rounded-2xl py-5 text-sm font-semibold uppercase tracking-[0.22em]"
                >
                  {hostLoading ? 'Creating…' : 'Create Room'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {role === 'player' && !playerSession && (
          <Card className={panelCardClasses}>
            <CardHeader className="border-b border-white/60 bg-gradient-to-r from-white/90 via-white/60 to-white/40 px-8 py-8 dark:border-white/5 dark:from-white/10 dark:via-white/5 dark:to-transparent">
              <CardTitle className="text-3xl font-heading text-slate-900 dark:text-white">Join a Room</CardTitle>
              <CardDescription className="text-base text-slate-600 dark:text-slate-300">
                Enter the code shared by your host to play along in real time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-8 pb-10 pt-6">
              <form onSubmit={handleJoinRoom} className="space-y-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="player-name"
                      className="text-sm font-heading uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300"
                    >
                      Your name
                    </label>
                    <Input
                      id="player-name"
                      value={playerNameInput}
                      onChange={(event) => setPlayerNameInput(event.target.value)}
                      placeholder="e.g., Player One"
                      required
                      className="h-12 rounded-2xl border border-white/60 bg-white/80 px-4 text-slate-900 shadow-sm transition focus:border-purple-400 focus:ring-4 focus:ring-purple-200/60 dark:border-white/10 dark:bg-white/10 dark:text-white dark:focus:border-purple-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="player-room"
                      className="text-sm font-heading uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300"
                    >
                      Room code
                    </label>
                    <Input
                      id="player-room"
                      value={playerRoomCodeInput}
                      onChange={(event) => setPlayerRoomCodeInput(event.target.value)}
                      placeholder="e.g., ABC123"
                      required
                      className="h-12 rounded-2xl border border-white/60 bg-white/80 px-4 text-slate-900 uppercase shadow-sm transition focus:border-purple-400 focus:ring-4 focus:ring-purple-200/60 dark:border-white/10 dark:bg-white/10 dark:text-white dark:focus:border-purple-400"
                    />
                  </div>
                </div>
                {playerError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    {playerError}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={playerLoading}
                  variant="neutral"
                  className="w-full rounded-2xl py-5 text-sm font-semibold uppercase tracking-[0.22em]"
                >
                  {playerLoading ? 'Joining…' : 'Join Room'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

          {hostSession && hostRoomState && renderHostView()}

          {playerSession && playerRoomState && renderPlayerView()}
        </div>
      </div>
    </div>
  );
}

export default function MultiplayerPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-slate-600 dark:text-slate-300">Loading...</p>
      </div>
    }>
      <MultiplayerPageContent />
    </Suspense>
  );
}
