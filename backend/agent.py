import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from backend.models import QuizResponse
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize the Google Generative AI model
GEMINI_LLM = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.7,
)

# Define the prompt template for the quiz generator
QUIZ_GENERATOR_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """
        You are an expert quiz generator.

        You will be given three inputs: a prompt, the number of questions, and the difficulty level. Optionally, you may also receive a file.
        - The prompt will be a topic for the quiz. Generate questions based on this topic and do not stray from it.
        - The number of questions will determine how many questions to generate. You must not go under or over this amount.
        - The difficulty level will determine the complexity of the questions. Never go above or below the specified level.
        - If a file is provided, use its data to generate the quiz questions. If the file data is "none", ignore it.

        Your output must be a structured JSON object.
        Provide 2 or 4 distinct choices for each question (2 for true/false, 4 for multiple choice).
        Keep the questions concise and easy to read.
        Abide by these rules, and most importantly, have fun!
        """,
        ),
        (
            "user",
            "Generate a quiz about the following topic: '{prompt}'. "
            "Number of questions: {num_questions}. "
            "Difficulty level: {difficulty}. "
            "File: {file_data}",
        ),
    ]
)

# Create the quiz generation chain by piping the prompt to the LLM
quiz_generation_chain = QUIZ_GENERATOR_PROMPT | GEMINI_LLM.with_structured_output(
    QuizResponse
)
