from fastapi import FastAPI, HTTPException, UploadFile, Form, File
from backend.models import QuizResponse, QuizRequest
from backend.agent import quiz_generation_chain

app = FastAPI(title="AI Kahoot")

@app.get("/")
def status():
    """
    Check the status of the API.

    Returns
    -------
    dict
        A dictionary with the status of the API.
    """
    try:
        return {"Status": "Site is working good!"}
    except:
        raise HTTPException(
            status_code=404,
            detail="API is not reachable."
        )

@app.post("/generate-quiz/", response_model=QuizResponse, summary="Generate a quiz using Gemini AI")
async def generate_quiz(request: QuizRequest):
    """
    Generate a quiz based on user input.

    Parameters
    ----------
    request : QuizRequest
        The request body containing the prompt, number of questions, and difficulty.

    Returns
    -------
    QuizResponse
        The generated quiz.

    Raises
    ------
    HTTPException
        If the quiz generation fails.
    """
    try:
        # This endpoint does not handle file uploads, so file_data is set to "none".
        result = await quiz_generation_chain.ainvoke({
            "prompt": request.prompt,
            "num_questions": request.num_questions,
            "difficulty": request.difficulty,
            "file_data": "none"
        })

        return result

    except Exception as e:
        print(f"Error during quiz generation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during quiz generation. Please check the logs for more details."
        )

@app.post("/generate-quiz-file/", response_model=QuizResponse, summary="Generate a quiz using Gemini AI")
async def generate_quiz_file(
    prompt: str = Form(...),
    num_questions: int = Form(...),
    difficulty: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Generate a quiz based on user input and a file.

    Parameters
    ----------
    prompt : str
        The prompt for the quiz.
    num_questions : int
        The number of questions to generate.
    difficulty : str
        The difficulty of the quiz.
    file : UploadFile
        The file to use for generating the quiz.

    Returns
    -------
    QuizResponse
        The generated quiz.

    Raises
    ------
    HTTPException
        If the quiz generation fails.
    """
    try:
        file_content_bytes = await file.read()
        try:
            file_content = file_content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Failed to decode the uploaded file. Please ensure it is a valid UTF-8 encoded text file."
            )

        result = await quiz_generation_chain.ainvoke({
            "prompt": prompt,
            "num_questions": num_questions,
            "difficulty": difficulty,
            "file_data": file_content
        })

        return result

    except Exception as e:
        print(f"Error during quiz generation with file: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during quiz generation with the provided file. Please check the logs for more details."
        )
