import asyncio
import secrets
import string
from typing import Dict, Optional
from uuid import uuid4

from backend.models import (
    ActiveQuestion,
    CreateRoomResponse,
    JoinRoomResponse,
    QuizResponse,
    RoomPlayerState,
    RoomStateResponse,
    SubmitAnswerRequest,
)

ROOM_CODE_LENGTH = 6
ROOM_CODE_ALPHABET = string.ascii_uppercase + string.digits


class RoomError(Exception):
    """Base class for room-related errors."""


class RoomNotFound(RoomError):
    """Raised when a room code does not exist."""


class Unauthorized(RoomError):
    """Raised when a host or player identifier is invalid for a room."""


class InvalidAction(RoomError):
    """Raised when an action is not allowed in the room's current state."""


_rooms: Dict[str, dict] = {}
_room_lock = asyncio.Lock()


def _generate_room_code() -> str:
    while True:
        code = "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(ROOM_CODE_LENGTH))
        if code not in _rooms:
            return code


def _normalize_code(code: str) -> str:
    return code.strip().upper()


def _ensure_room(code: str) -> dict:
    room = _rooms.get(code)
    if room is None:
        raise RoomNotFound(f"Room '{code}' does not exist.")
    return room


def _build_room_state(room: dict) -> RoomStateResponse:
    current_index: Optional[int] = room.get("current_question_index")
    quiz: QuizResponse = room["quiz"]
    total_questions = len(quiz.questions)

    active_question: Optional[ActiveQuestion] = None
    if room["status"] == "in_progress" and current_index is not None and 0 <= current_index < total_questions:
        question_model = quiz.questions[current_index]
        active_question = ActiveQuestion(
            question_index=current_index,
            question_number=current_index + 1,
            question=question_model.question,
            choices=list(question_model.choices),
            total_questions=total_questions,
        )

    players_state = [
        RoomPlayerState(
            player_id=player["id"],
            name=player["name"],
            score=player["score"],
            has_answered_current=room["status"] == "in_progress"
            and current_index is not None
            and player["id"] in room["answers"],
        )
        for player in room["players"].values()
    ]

    return RoomStateResponse(
        room_code=room["code"],
        status=room["status"],
        quiz_title=quiz.quiz_title,
        difficulty=room.get("difficulty", "Medium"),
        current_question_index=current_index,
        question_count=total_questions,
        players=players_state,
        question=active_question,
    )


async def create_room(host_name: str, quiz: QuizResponse, difficulty: str = "Medium") -> CreateRoomResponse:
    async with _room_lock:
        code = _generate_room_code()
        host_id = str(uuid4())
        _rooms[code] = {
            "code": code,
            "host_id": host_id,
            "host_name": host_name,
            "quiz": quiz,
            "difficulty": difficulty,
            "status": "waiting",
            "current_question_index": None,
            "players": {},
            "answers": {},
        }
        return CreateRoomResponse(room_code=code, host_id=host_id, quiz=quiz)


async def join_room(code: str, player_name: str) -> JoinRoomResponse:
    normalized_code = _normalize_code(code)
    async with _room_lock:
        room = _ensure_room(normalized_code)
        player_id = str(uuid4())
        room["players"][player_id] = {
            "id": player_id,
            "name": player_name,
            "score": 0,
            "answers": {},
        }
    return JoinRoomResponse(
        room_code=normalized_code,
        player_id=player_id,
        quiz_title=room["quiz"].quiz_title,
        status=room["status"],
    )


async def get_room_state(code: str) -> RoomStateResponse:
    normalized_code = _normalize_code(code)
    async with _room_lock:
        room = _ensure_room(normalized_code)
        return _build_room_state(room)


async def start_room(code: str, host_id: str) -> RoomStateResponse:
    normalized_code = _normalize_code(code)
    async with _room_lock:
        room = _ensure_room(normalized_code)
        if room["host_id"] != host_id:
            raise Unauthorized("Invalid host credentials for this room.")
        if room["status"] != "waiting":
            raise InvalidAction("This room has already been started.")
        if not room["players"]:
            raise InvalidAction("At least one player must join before starting the game.")
        room["status"] = "in_progress"
        room["current_question_index"] = 0
        room["answers"] = {}
        return _build_room_state(room)


async def advance_room(code: str, host_id: str) -> RoomStateResponse:
    normalized_code = _normalize_code(code)
    async with _room_lock:
        room = _ensure_room(normalized_code)
        if room["host_id"] != host_id:
            raise Unauthorized("Invalid host credentials for this room.")
        if room["status"] != "in_progress":
            raise InvalidAction("Cannot advance questions when the game is not in progress.")

        current_index = room["current_question_index"]
        total_questions = len(room["quiz"].questions)

        if current_index is None:
            raise InvalidAction("No active question to advance from.")

        if current_index >= total_questions - 1:
            room["status"] = "finished"
            room["answers"] = {}
        else:
            room["current_question_index"] = current_index + 1
            room["answers"] = {}
        return _build_room_state(room)


async def submit_answer(code: str, request: SubmitAnswerRequest) -> RoomStateResponse:
    normalized_code = _normalize_code(code)
    async with _room_lock:
        room = _ensure_room(normalized_code)
        if room["status"] != "in_progress":
            raise InvalidAction("Answers can only be submitted while the game is in progress.")

        player = room["players"].get(request.player_id)
        if player is None:
            raise Unauthorized("Player is not part of this room.")

        current_index = room["current_question_index"]
        if current_index is None:
            raise InvalidAction("No active question to answer.")

        if player["id"] in room["answers"]:
            raise InvalidAction("Player has already answered the current question.")

        current_question = room["quiz"].questions[current_index]
        is_correct = request.answer.strip() == current_question.answer
        player["answers"][current_index] = {
            "answer": request.answer,
            "is_correct": is_correct,
        }
        if is_correct:
            player["score"] += 1

        room["answers"][player["id"]] = request.answer
        return _build_room_state(room)

