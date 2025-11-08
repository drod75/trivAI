from fastapi import FastAPI, HTTPException
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
            "difficulty": request.difficulty
        })

        return result

    except Exception as e:
        print(f"Error during quiz generation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Quiz generation failed due to an internal error. Ensure the API key is valid. Details: {e}"
        )

if __name__ == '__main__':
    prompt = "Give me questions of New York!"
    num_questions = 3
    difficulty = "Hard"

    answer = quiz_generator_chain.invoke({
        "prompt": prompt,
        "num_questions": num_questions,
        "difficulty": difficulty
    })
    print(answer)
