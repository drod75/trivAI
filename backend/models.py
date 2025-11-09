from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class QuizQuestion(BaseModel):
    """
    Represents a single quiz question with multiple choices and a correct answer.
    """
    question: str = Field(description="The text of the multiple-choice question.")
    choices: List[str] = Field(description="A list of 4 possible answer choices.")
    answer: str = Field(description="The correct answer, which must be one of the strings in the 'choices' list.")

class QuizResponse(BaseModel):
    """
    Represents the structure of the generated quiz.
    """
    quiz_title: str = Field(description="A concise and engaging title for the quiz.")
    questions: List[QuizQuestion] = Field(description="A list of the generated quiz questions.")

class QuizRequest(BaseModel):
    """
    Represents the request to generate a quiz, specifying the topic, number of questions, and difficulty.
    """
    prompt: str = Field(default="The French Revolution", description="The topic for the quiz (e.g., 'The French Revolution').")
    num_questions: int = Field(
        default=5,
        description="The desired number of questions (between 1 and 30).",
        ge=1,
        le=30,
    )
    difficulty: str = Field(default="Medium", description="The difficulty level of the quiz (e.g., 'Easy', 'Medium', 'Hard').")


class CreateRoomRequest(QuizRequest):
    """
    Request payload for hosts to create a multiplayer room and generate a quiz.
    """
    host_name: str = Field(description="Display name for the host presented to players.")
    quiz: Optional[QuizResponse] = Field(default=None, description="Optional pre-generated quiz (e.g., from file upload).")


class CreateRoomResponse(BaseModel):
    """
    Response returned when a room is created successfully.
    """
    room_code: str = Field(description="The unique join code players use to enter the room.")
    host_id: str = Field(description="Private identifier for the host to authorize room actions.")
    quiz: QuizResponse = Field(description="The generated quiz for this room.")


class JoinRoomRequest(BaseModel):
    """
    Request payload for players joining an existing room.
    """
    player_name: str = Field(description="Display name shown to the host and other players.")


class JoinRoomResponse(BaseModel):
    """
    Response returned when a player joins a room successfully.
    """
    room_code: str = Field(description="Echo of the room code that was joined.")
    player_id: str = Field(description="Private identifier for the player to authorize future actions.")
    quiz_title: str = Field(description="Title of the quiz associated with the room.")
    status: Literal["waiting", "in_progress", "finished"] = Field(description="Current status of the room.")


class ActiveQuestion(BaseModel):
    """
    Represents the question currently being played in the room.
    """
    question_index: int = Field(description="Zero-based index of the active question.")
    question_number: int = Field(description="One-based question number for display.")
    question: str = Field(description="Question text presented to players.")
    choices: List[str] = Field(description="Multiple-choice options available for this question.")
    total_questions: int = Field(description="Total number of questions in the quiz.")


class RoomPlayerState(BaseModel):
    """
    Represents a player's status within a room.
    """
    player_id: str = Field(description="Private identifier representing the player session.")
    name: str = Field(description="Display name chosen by the player.")
    score: int = Field(description="Number of correct answers submitted so far.")
    has_answered_current: bool = Field(description="Whether the player has answered the current question.")


class RoomStateResponse(BaseModel):
    """
    Response payload describing the current state of a room, used by both hosts and players.
    """
    room_code: str = Field(description="Room code being observed.")
    status: Literal["waiting", "in_progress", "finished"] = Field(description="Overall status of the room.")
    quiz_title: str = Field(description="Title of the quiz for this room.")
    difficulty: str = Field(default="Medium", description="Difficulty level of the quiz (Easy, Medium, Hard).")
    current_question_index: Optional[int] = Field(
        default=None,
        description="Zero-based index of the active question, or None if not started."
    )
    question_count: int = Field(description="Total number of questions in the quiz.")
    players: List[RoomPlayerState] = Field(description="Current roster of players in the room.")
    question: Optional[ActiveQuestion] = Field(
        default=None,
        description="Details for the active question when the game is in progress."
    )


class HostActionRequest(BaseModel):
    """
    Simple request body used to authorize host-initiated actions.
    """
    host_id: str = Field(description="Private identifier for the host session.")


class SubmitAnswerRequest(BaseModel):
    """
    Request payload for players submitting an answer.
    """
    player_id: str = Field(description="Private identifier representing the player session.")
    answer: str = Field(description="Selected answer option for the current question.")
