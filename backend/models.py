from pydantic import BaseModel, Field
from typing import List

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
    num_questions: int = Field(default=5, description="The desired number of questions (between 1 and 10).", ge=1, le=10)
    difficulty: str = Field(default="Medium", description="The difficulty level of the quiz (e.g., 'Easy', 'Medium', 'Hard').")
