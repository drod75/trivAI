from pydantic import BaseModel, Field
from typing import List

class QuizQuestion(BaseModel):
    question: str = Field(description="The multiple-choice question text.")
    choices: List[str] = Field(description="A list of 4 possible answer choices, including the correct one.")
    answer: str = Field(description="The correct answer choice, which must be one of the strings in the 'choices' list.")

class QuizResponse(BaseModel):
    quiz_title: str = Field(description="A concise title for the generated quiz.")
    questions: List[QuizQuestion] = Field(description="A list of the generated quiz questions.")

class QuizRequest(BaseModel):
    prompt: str = Field(default="The french revolution.", description="The topic for the quiz (e.g., 'The French Revolution').")
    num_questions: int = Field(default=5, description="The desired number of questions (1-10).", ge=1, le=10)
    difficulty: str = Field(default="Medium", description="The difficulty level (Easy, Medium, or Hard).")
