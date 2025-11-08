import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from backend.models import QuizResponse
from dotenv import load_dotenv
import os

load_dotenv()

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    api_key = os.getenv("GOOGLE_API_KEY"),
    temperature=0.7
)

prompt = ChatPromptTemplate.from_messages([
    ("system",
        """
        You are an expert quiz generator:

        You will be given three inputs, the prompt, the number of questions, and the difficulty.
        - The prompt will be a topic that allows, you are to generate your questions based on this
        - The number of questions will decide how many to generate, you will not go under or above this amount
        - The difficulty is how you will tune the questions difficulty, never go above or below the level they specify.

        Your output will to be a structured output,
        provide 2 or 4 distinct choices 2 being for true and false,
        make the questions not to long, make them simple and quick to read,
        abide by these rules, and most importantly, have fun!
        """
    ),
    ("user",
     "Generate a quiz about the following topic: '{prompt}'. "
     "Number of questions: {num_questions}. "
     "Difficulty level: {difficulty}. "
    )
])

quiz_generator_chain = prompt | llm.with_structured_output(QuizResponse)
