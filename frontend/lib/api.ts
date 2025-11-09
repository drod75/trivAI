export type QuizQuestion = {
  question: string;
  choices: string[];
  answer: string;
};

export type QuizResponse = {
  quiz_title: string;
  questions: QuizQuestion[];
};

export type RoomPlayerState = {
  player_id: string;
  name: string;
  score: number;
  has_answered_current: boolean;
};

export type ActiveQuestion = {
  question_index: number;
  question_number: number;
  question: string;
  choices: string[];
  total_questions: number;
};

export type RoomStateResponse = {
  room_code: string;
  status: "waiting" | "in_progress" | "finished";
  quiz_title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  current_question_index: number | null;
  question_count: number;
  players: RoomPlayerState[];
  question: ActiveQuestion | null;
};

export type CreateRoomResponse = {
  room_code: string;
  host_id: string;
  quiz: QuizResponse;
};

export type JoinRoomResponse = {
  room_code: string;
  player_id: string;
  quiz_title: string;
  status: "waiting" | "in_progress" | "finished";
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3002";

export async function generateQuiz(opts: {
  prompt: string;
  num_questions: number;
  difficulty: string;
}): Promise<QuizResponse> {
  const res = await fetch(`${API}/generate-quiz/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Quiz API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function createMultiplayerRoom(opts: {
  host_name: string;
  prompt: string;
  num_questions: number;
  difficulty: string;
}): Promise<CreateRoomResponse> {
  const res = await fetch(`${API}/rooms/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Create room API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function joinMultiplayerRoom(
  roomCode: string,
  opts: { player_name: string }
): Promise<JoinRoomResponse> {
  const res = await fetch(`${API}/rooms/${roomCode}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Join room API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function fetchRoomState(roomCode: string): Promise<RoomStateResponse> {
  const res = await fetch(`${API}/rooms/${roomCode}/state`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fetch room state API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function startMultiplayerRoom(
  roomCode: string,
  hostId: string
): Promise<RoomStateResponse> {
  const res = await fetch(`${API}/rooms/${roomCode}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ host_id: hostId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Start room API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function advanceMultiplayerRoom(
  roomCode: string,
  hostId: string
): Promise<RoomStateResponse> {
  const res = await fetch(`${API}/rooms/${roomCode}/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ host_id: hostId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Advance room API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function submitMultiplayerAnswer(
  roomCode: string,
  playerId: string,
  answer: string
): Promise<RoomStateResponse> {
  const res = await fetch(`${API}/rooms/${roomCode}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ player_id: playerId, answer }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Submit answer API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}
