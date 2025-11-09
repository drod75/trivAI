'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

export default function MultiplayerPage() {
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

  const activeRoleTile: Exclude<ViewRole, 'chooser'> | null = role === 'chooser' ? null : role;
  const panelCardClasses =
    'overflow-hidden rounded-[32px] bg-white/85 shadow-[0_50px_120px_-70px_rgba(79,70,229,0.45)] backdrop-blur-2xl dark:bg-white/10 dark:shadow-[0_50px_120px_-70px_rgba(56,189,248,0.45)]';
  const secondaryCardClasses =
    'rounded-[28px] border border-white/60 bg-white/80 shadow-[0_40px_120px_-70px_rgba(79,70,229,0.35)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_40px_120px_-70px_rgba(56,189,248,0.35)]';

  useRoomPolling(hostSession?.roomCode ?? null, Boolean(hostSession), setHostRoomState, setHostError);

  useRoomPolling(playerSession?.roomCode ?? null, Boolean(playerSession), setPlayerRoomState, setPlayerError);

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
    if (!hostSession) return;
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
    return (
      <Card className={secondaryCardClasses}>
        <CardHeader>
          <CardTitle>Scoreboard</CardTitle>
          <CardDescription>Track progress for everyone in the room.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedPlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No players yet.</p>
          ) : (
            <ul className="space-y-2">
              {sortedPlayers.map((player, index) => (
                <li
                  key={player.player_id}
                  className="flex items-center justify-between rounded-lg border border-muted px-4 py-3"
                >
                  <span className="font-semibold">
                    {index + 1}. {player.name}
                  </span>
                  <div className="flex items-center gap-3 text-sm">
                    <span>{player.score} pts</span>
                    {state.status === 'in_progress' && (
                      <span className={player.has_answered_current ? 'text-emerald-600' : 'text-muted-foreground'}>
                        {player.has_answered_current ? 'Answered' : 'Waiting'}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
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
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Join Code</p>
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-primary/10 px-4 py-2 text-2xl font-bold tracking-widest text-primary">
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
            <div>
              <p className="font-semibold text-lg">{hostSession.quiz.quiz_title}</p>
              <p className="text-sm text-muted-foreground">
                {hostSession.quiz.questions.length} questions · Difficulty {hostSession.difficulty}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>Status: <strong className="text-foreground">{hostRoomState.status.replace('_', ' ')}</strong></span>
              <span>Total players: <strong className="text-foreground">{totalPlayers}</strong></span>
              {hostRoomState.status === 'in_progress' && (
                <span>
                  Answered: <strong className="text-foreground">{answeredPlayers}</strong>
                </span>
              )}
            </div>

            {hostRoomState.status === 'waiting' && (
              <Button
                type="button"
                onClick={handleStartRoom}
                disabled={hostActionLoading || totalPlayers === 0}
              >
                {hostActionLoading ? 'Starting…' : 'Start Game'}
              </Button>
            )}

            {hostRoomState.status === 'in_progress' && (
              <Button type="button" onClick={handleAdvanceRoom} disabled={hostActionLoading}>
                {hostActionLoading ? 'Updating…' : isLastQuestion ? 'Finish Game' : 'Next Question'}
              </Button>
            )}
          </CardContent>
        </Card>

        {hostRoomState.question && currentQuestion && (
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
                        isCorrect ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' : 'border-muted'
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

    return (
      <div className="space-y-6">
        <Card className={secondaryCardClasses}>
          <CardHeader>
            <CardTitle>Welcome, {playerSession.playerName}</CardTitle>
            <CardDescription>Room {playerSession.roomCode}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Status: <strong className="text-foreground">{playerRoomState.status.replace('_', ' ')}</strong>
            </p>
            {playerRoomState.status === 'waiting' && (
              <p className="text-sm text-muted-foreground">
                Waiting for the host to start the game. Keep this window open!
              </p>
            )}
          </CardContent>
        </Card>

        {currentQuestion && playerRoomState.status === 'in_progress' && (
          <Card className={secondaryCardClasses}>
            <CardHeader>
              <CardTitle>
                Question {currentQuestion.question_number} of {currentQuestion.total_questions}
              </CardTitle>
              <CardDescription>Select your answer below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg font-semibold">{currentQuestion.question}</p>
              <div className="grid gap-3">
                {currentQuestion.choices.map((choice) => (
                  <Button
                    key={choice}
                    variant={hasAnswered ? 'neutral' : 'default'}
                    className="justify-start text-left"
                    disabled={hasAnswered || playerAnswerLoading}
                    onClick={() => handleSubmitAnswer(choice)}
                  >
                    {choice}
                  </Button>
                ))}
              </div>
              {hasAnswered && (
                <p className="text-sm text-muted-foreground">Answer received! Waiting for the host to move on.</p>
              )}
            </CardContent>
          </Card>
        )}

        {playerRoomState.status === 'finished' && renderScoreboard(playerRoomState)}
      </div>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#ede7ff] via-[#f3f7ff] to-[#ffe7f1] p-4 md:p-10 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-purple-300/40 blur-3xl dark:bg-purple-600/20" />
        <div className="absolute top-1/3 -right-16 h-72 w-72 rounded-full bg-blue-300/30 blur-3xl dark:bg-sky-600/20" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-pink-200/40 blur-3xl dark:bg-pink-500/10" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 md:gap-12">
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
              <Link href="/" className="font-semibold text-primary underline-offset-4 hover:underline">
                Generate a single-player quiz instead.
              </Link>
            </div>
          </div>
        </section>

        <div className="space-y-6 md:space-y-8">
          {role === 'chooser' && (
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
                      required
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
                    <Input
                      id="host-questions"
                      type="number"
                      min={1}
                      max={30}
                      value={hostNumQuestions}
                      onChange={(event) => setHostNumQuestions(Number(event.target.value))}
                      className="h-12 rounded-2xl border border-white/60 bg-white/80 px-4 text-slate-900 shadow-sm transition focus:border-purple-400 focus:ring-4 focus:ring-purple-200/60 dark:border-white/10 dark:bg-white/10 dark:text-white dark:focus:border-purple-400"
                    />
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
                      className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-4 focus:ring-purple-200/60 dark:border-white/10 dark:bg-white/10 dark:text-white dark:focus:border-purple-400"
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

