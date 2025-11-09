"""
This module initializes and configures the quiz generation agent.

It includes functions to:
- Initialize the Google Generative AI model.
- Define the prompt template for the quiz generator.
- Create the quiz generation chain by piping the prompt to the LLM.
"""
import os
from pathlib import Path
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from backend.models import QuizResponse
from dotenv import load_dotenv

# Load environment variables from backend/.env file
backend_dir = Path(__file__).parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)
print(f"Loaded .env from: {env_path}")
# Also load from project root as fallback
load_dotenv()

# Initialize the Google Generative AI model
def get_gemini() -> ChatGoogleGenerativeAI:
    """
    Initializes and returns a ChatGoogleGenerativeAI instance.

    This function configures the model with specific parameters for the quiz generation task.
    It uses the "gemini-2.5-flash" model, sets a timeout, retrieves the API key from environment variables,
    and sets the temperature for controlling the creativity of the responses.

    Returns:
        ChatGoogleGenerativeAI: An instance of the ChatGoogleGenerativeAI class.
    """
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        print("WARNING: GOOGLE_API_KEY is not set or invalid!")
        raise ValueError("GOOGLE_API_KEY environment variable is not set properly. Please set it in backend/.env file.")
    
    print(f"Initializing Gemini with API key: {api_key[:10]}...")
    GEMINI_LLM = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        timeout=120,  # Increased timeout to 120 seconds
        api_key=api_key,
        temperature=0.7,
    )

    return GEMINI_LLM

# Define the prompt template for the quiz generator
def get_prompt():
    """
    Defines and returns the prompt template for the quiz generator.

    The prompt template is designed to guide the language model in creating a quiz.
    It includes a system message that sets the context and rules for the quiz generation,
    and a user message that provides the specific details for the quiz to be generated.

    Returns:
        ChatPromptTemplate: An instance of the ChatPromptTemplate class.
    """
    QUIZ_GENERATOR_PROMPT = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """
                You are an expert quiz generator.

                Imagine you are an expert that works on crafting kahoot questions, your goal is to create fun and appropriate quizzes
                based on what the user tells you, the topics they talk about can be anything, and it could be of any length and difficulty.
                The primary objective is to create fun and exciting quizzes that can be tailored to the user, so make sure they have fun!

                You will be given three inputs: a prompt, the number of questions, and the difficulty level. Optionally, you may also receive a file.
                - The prompt will be a topic for the quiz. Generate questions based on this topic and do not stray from it.
                - The number of questions will determine how many questions to generate. You must not go under or over this amount.
                - The difficulty level will determine the complexity of the questions. Never go above or below the specified level.
                - If a file is provided, use its data to generate the quiz questions. If the file data is "none", ignore it.

                For constraints you are to follow the below:
                - If there is a file being provided, use its data to generate the quiz questions, and do not use the prompt.
                - Provide 2 or 4 distinct choices for each question (2 for true/false, 4 for multiple choice).
                - Keep the questions concise and easy to read.
                - There has to be an answer, and it must be one of the choices provided.
                - Abide by these rules, and most importantly, have fun!

                For output restraints:
                - Your output is configured to be a structured output.
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

    return QUIZ_GENERATOR_PROMPT

# Create the quiz generation chain by piping the prompt to the LLM
def get_chain():
    """
    Creates and returns the quiz generation chain.

    This function assembles the quiz generation chain by:
    1. Initializing the Gemini LLM.
    2. Configuring the LLM for structured output using the QuizResponse model.
    3. Retrieving the prompt template.
    4. Piping the prompt template to the structured LLM.

    Returns:
        A chain of Runnables that takes a dictionary of inputs and returns a QuizResponse.
    """
    GEMINI_LLM = get_gemini()
    STRUCTURED_GEMINI = GEMINI_LLM.with_structured_output(QuizResponse)
    QUIZ_GENERATOR_PROMPT = get_prompt()
    quiz_generation_chain = QUIZ_GENERATOR_PROMPT | STRUCTURED_GEMINI
    return quiz_generation_chain
