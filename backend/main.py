from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path
import httpx
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from typing import Optional
import base64

# your existing imports
from backend.models import (
    CreateRoomRequest,
    CreateRoomResponse,
    HostActionRequest,
    JoinRoomRequest,
    JoinRoomResponse,
    QuizResponse,
    QuizRequest,
    RoomStateResponse,
    SubmitAnswerRequest,
)
from backend.agent import get_chain
from backend.rooms import (
    InvalidAction,
    RoomNotFound,
    Unauthorized,
    advance_room,
    create_room,
    get_room_state,
    join_room,
    start_room,
    submit_answer,
)
from backend.chat import (
    ChatRequest,
    ChatResponse,
    process_chat_message,
    generate_flashcards,
    generate_questions_from_file,
)

# Ensure .env is loaded from backend directory
backend_dir = Path(__file__).parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)
if env_path.exists():
    print(f"✓ Loaded .env from: {env_path}")
else:
    print(f"⚠ Warning: .env file not found at {env_path}, using environment variables")
# Also load from project root as fallback
load_dotenv()

app = FastAPI(title="AI Kahoot", description="Generate quizzes using Gemini AI!")

# Lazy initialization to avoid blocking startup
quiz_llm = None

def get_quiz_llm():
    global quiz_llm
    if quiz_llm is None:
        print("Initializing quiz chain...")
        quiz_llm = get_chain()
        print("Quiz chain initialized successfully")
    return quiz_llm


def _handle_room_exception(exc: Exception):
    if isinstance(exc, RoomNotFound):
        raise HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, Unauthorized):
        raise HTTPException(status_code=403, detail=str(exc))
    if isinstance(exc, InvalidAction):
        raise HTTPException(status_code=400, detail=str(exc))
    raise HTTPException(status_code=500, detail="An unexpected error occurred while handling the room.")

origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def status():
    """Simple health check."""
    return {"Status": "Site is working good!"}

# -------------------------
# QUIZ (existing endpoints)
# -------------------------

@app.post("/generate-quiz/", response_model=QuizResponse, summary="Generate a quiz using Gemini AI")
async def generate_quiz(request: QuizRequest):
    try:
        print(f"Generating quiz: topic='{request.prompt}', questions={request.num_questions}, difficulty={request.difficulty}")
        llm = get_quiz_llm()
        result = await llm.ainvoke({
            "prompt": request.prompt,
            "num_questions": request.num_questions,
            "difficulty": request.difficulty,
            "file_data": "none"
        })
        print(f"Quiz generated successfully: {result.quiz_title}")
        return result
    except ValueError as e:
        print(f"Configuration error: {e}")
        raise HTTPException(status_code=500, detail=f"Configuration error: {str(e)}")
    except Exception as e:
        print(f"Error during quiz generation: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")

# -------------------------
# MULTIPLAYER (existing)
# -------------------------

@app.post("/rooms/", response_model=CreateRoomResponse, summary="Create a multiplayer room and generate a quiz")
async def create_room_endpoint(request: CreateRoomRequest):
    try:
        print(f"Creating room: host='{request.host_name}', topic='{request.prompt}', questions={request.num_questions}, difficulty={request.difficulty}")
        # Check if quiz is provided directly (from file upload)
        if hasattr(request, 'quiz') and request.quiz:
            # Use provided quiz (from file upload)
            quiz = request.quiz
        else:
            # Generate quiz from prompt
            llm = get_quiz_llm()
            quiz = await llm.ainvoke({
                "prompt": request.prompt,
                "num_questions": request.num_questions,
                "difficulty": request.difficulty,
                "file_data": "none"
            })
        response = await create_room(request.host_name, quiz, request.difficulty)
        print(f"Room created successfully: code='{response.room_code}'")
        return response
    except (RoomNotFound, Unauthorized, InvalidAction) as exc:
        _handle_room_exception(exc)
    except Exception as e:
        print(f"Error during room creation: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create room: {str(e)}")

@app.post("/rooms/{room_code}/join", response_model=JoinRoomResponse, summary="Join an existing multiplayer room")
async def join_room_endpoint(room_code: str, request: JoinRoomRequest):
    try:
        response = await join_room(room_code, request.player_name)
        print(f"Player '{request.player_name}' joined room '{response.room_code}'")
        return response
    except (RoomNotFound, Unauthorized, InvalidAction) as exc:
        _handle_room_exception(exc)
    except Exception as e:
        print(f"Error while joining room '{room_code}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to join room: {str(e)}")

@app.get("/rooms/{room_code}/state", response_model=RoomStateResponse, summary="Get the current state for a multiplayer room")
async def room_state_endpoint(room_code: str):
    try:
        return await get_room_state(room_code)
    except (RoomNotFound, Unauthorized, InvalidAction) as exc:
        _handle_room_exception(exc)
    except Exception as e:
        print(f"Error fetching room state for '{room_code}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch room state: {str(e)}")

@app.post("/rooms/{room_code}/start", response_model=RoomStateResponse, summary="Begin the quiz for a multiplayer room")
async def start_room_endpoint(room_code: str, request: HostActionRequest):
    try:
        return await start_room(room_code, request.host_id)
    except (RoomNotFound, Unauthorized, InvalidAction) as exc:
        _handle_room_exception(exc)
    except Exception as e:
        print(f"Error starting room '{room_code}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start room: {str(e)}")

@app.post("/rooms/{room_code}/next", response_model=RoomStateResponse, summary="Advance to the next question in a multiplayer room")
async def advance_room_endpoint(room_code: str, request: HostActionRequest):
    try:
        return await advance_room(room_code, request.host_id)
    except (RoomNotFound, Unauthorized, InvalidAction) as exc:
        _handle_room_exception(exc)
    except Exception as e:
        print(f"Error advancing room '{room_code}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to advance room: {str(e)}")

@app.post("/rooms/{room_code}/answer", response_model=RoomStateResponse, summary="Submit an answer for the current question")
async def submit_answer_endpoint(room_code: str, request: SubmitAnswerRequest):
    try:
        return await submit_answer(room_code, request)
    except (RoomNotFound, Unauthorized, InvalidAction) as exc:
        _handle_room_exception(exc)
    except Exception as e:
        print(f"Error submitting answer in room '{room_code}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit answer: {str(e)}")

# -------------------------
# NEW: ElevenLabs TTS
# -------------------------

class TTSRequest(BaseModel):
    text: str
    voice_id: str | None = None
    model_id: str | None = None

@app.post("/tts", response_class=StreamingResponse, summary="Speak text with ElevenLabs")
async def tts(req: TTSRequest):
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        return StreamingResponse(iter([b"Missing ELEVENLABS_API_KEY"]), media_type="text/plain", status_code=500)

    voice_id = req.voice_id or os.getenv("ELEVENLABS_VOICE_ID", "RkPzsL2i3teMYv0FxEYQ6")
    model_id = req.model_id or os.getenv("ELEVENLABS_MODEL_ID", "eleven_turbo_v2")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }
    payload = {
        "text": req.text.strip(),
        "model_id": model_id,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=payload)
        if r.status_code != 200:
            return StreamingResponse(iter([r.text.encode()]), media_type="text/plain", status_code=r.status_code)
        return StreamingResponse(r.aiter_bytes(), media_type="audio/mpeg")

# -------------------------
# AI CHAT (new endpoints)
# -------------------------

@app.post("/chat/", response_model=ChatResponse, summary="Chat with AI assistant")
async def chat_endpoint(request: ChatRequest):
    try:
        print(f"Chat endpoint called with {len(request.messages)} messages")
        if request.messages:
            print(f"Last message: {request.messages[-1].content[:100]}...")
        print(f"Request has file_data: {bool(request.file_data)}, file_type: {request.file_type}")
        
        # Process with longer timeout - Gemini can take time, especially with files
        import asyncio
        response = await asyncio.wait_for(
            process_chat_message(request),
            timeout=60.0  # 60 second timeout - generous for AI responses
        )
        print(f"Chat endpoint returning response (length: {len(response.message)})")
        return response
    except asyncio.TimeoutError:
        print("Chat endpoint timeout after 60 seconds")
        raise HTTPException(
            status_code=504, 
            detail="The AI is taking too long to respond. This might happen with large files or complex requests. Please try with a shorter message or smaller file."
        )
    except Exception as e:
        error_msg = str(e)
        print(f"Error during chat: {error_msg}")
        import traceback
        traceback.print_exc()
        # Don't expose internal error details to user
        if "timeout" in error_msg.lower():
            raise HTTPException(
                status_code=504,
                detail="Request timed out. Please try with a shorter message or wait a moment and try again."
            )
        raise HTTPException(status_code=500, detail=f"Chat failed: {error_msg}")

@app.post("/chat/flashcards/", response_model=ChatResponse, summary="Generate flash cards")
async def generate_flashcards_endpoint(topic: str, count: int = 5):
    try:
        response = await generate_flashcards(topic, count)
        return response
    except Exception as e:
        print(f"Error generating flash cards: {e}")
        raise HTTPException(status_code=500, detail=f"Flash card generation failed: {str(e)}")

@app.post("/chat/upload/", response_model=ChatResponse, summary="Upload file and generate questions")
async def upload_file_endpoint(
    file: UploadFile = File(...),
    count: int = 5
):
    try:
        # Read file content
        file_content = await file.read()
        file_data = base64.b64encode(file_content).decode('utf-8')
        
        # Generate questions from file
        response = await generate_questions_from_file(file_data, file.content_type or "unknown", count)
        return response
    except Exception as e:
        print(f"Error processing file: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")

@app.post("/generate-quiz-from-file/", response_model=QuizResponse, summary="Generate quiz from uploaded file")
async def generate_quiz_from_file_endpoint(
    file: UploadFile = File(...),
    num_questions: int = Form(5),
    difficulty: str = Form("Medium"),
    description: Optional[str] = Form(None)
):
    try:
        # Read file content
        file_content = await file.read()
        file_data = base64.b64encode(file_content).decode('utf-8')
        
        # Build prompt with optional description
        if description and description.strip():
            prompt = f"Generate a quiz based on the uploaded {file.content_type} file. User instructions: {description.strip()}"
        else:
            prompt = f"Generate a quiz based on the uploaded {file.content_type} file. Create questions that test understanding of the key concepts and important information from the file."
        
        print(f"Generating quiz from file: {file.filename}, type: {file.content_type}, questions: {num_questions}, difficulty: {difficulty}")
        if description:
            print(f"User description: {description[:100]}...")
        
        # Use the existing quiz generation with file data
        llm = get_quiz_llm()
        result = await llm.ainvoke({
            "prompt": prompt,
            "num_questions": num_questions,
            "difficulty": difficulty,
            "file_data": file_data  # Pass file data to the agent
        })
        print(f"Quiz generated successfully from file: {result.quiz_title}")
        return result
    except Exception as e:
        print(f"Error generating quiz from file: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Quiz generation from file failed: {str(e)}")

@app.post("/chat/speech-to-text/", summary="Convert speech to text")
async def speech_to_text_endpoint(audio: UploadFile = File(...)):
    try:
        # TODO: Implement speech-to-text using Google Speech-to-Text API or similar
        # For now, return placeholder
        return {"text": "Speech-to-text conversion coming soon. Please use text input for now."}
    except Exception as e:
        print(f"Error converting speech: {e}")
        raise HTTPException(status_code=500, detail=f"Speech conversion failed: {str(e)}")