from fastapi import FastAPI, HTTPException, UploadFile, Form, File
from backend.models import QuizResponse, QuizRequest
from backend.agent import quiz_generator_chain

app = FastAPI(title="AI Kahoot")

@app.get("/")
def status():
    try:
        return {"Status": "Site is working good!"}
    except:
        raise HTTPException(
            status_code=404,
            detail="Site not working :("
        )

@app.post("/generate-quiz/", response_model=QuizResponse, summary="Generate a quiz using Gemini AI")
async def generate_quiz(request: QuizRequest):
    """
    Returns questions based on user input!
    """
    try:
        result = await quiz_generator_chain.ainvoke({
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
            detail=f"Quiz generation failed due to an internal error. Ensure the API key is valid. Details: {e}"
        )

@app.post("/generate-quiz-file/", response_model=QuizResponse, summary="Generate a quiz using Gemini AI")
async def generate_quiz_file(
    prompt: str = Form(...),
    num_questions: int = Form(...),
    difficulty: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Returns questions based on user input!
    """
    try:
        file_content = await file.read()
        result = await quiz_generator_chain.ainvoke({
            "prompt": prompt,
            "num_questions": num_questions,
            "difficulty": difficulty,
            "file_data": file_content.decode("utf-8")
        })

        return result

    except Exception as e:
        print(f"Error during quiz generation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Quiz generation with Data failed due to an internal error. Ensure the API key is valid. Details: {e}"
        )
