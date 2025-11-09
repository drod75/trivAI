from pydantic import BaseModel
from typing import Optional, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage
import os
import base64
from pathlib import Path

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    images: Optional[List[str]] = None  # Base64 encoded images

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    file_data: Optional[str] = None  # Base64 encoded file
    file_type: Optional[str] = None  # MIME type

class ChatResponse(BaseModel):
    message: str
    images: Optional[List[str]] = None  # Generated images (if any)

def get_chat_llm():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not found in environment")
    # Use faster model for quicker responses
    return ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",  # Faster than pro
        google_api_key=api_key, 
        temperature=0.7,  # Balanced temperature for better responses
        max_output_tokens=2048,  # Increased for better responses
        timeout=90.0,  # 90 second timeout at LLM level
    )

async def process_chat_message(request: ChatRequest) -> ChatResponse:
    """Process chat message with AI, supporting file analysis and question generation"""
    llm = get_chat_llm()
    
    # Build context from messages - keep it concise for speed
    conversation = []
    
    # Only include last 5 messages for context to speed up processing
    recent_messages = request.messages[-5:] if len(request.messages) > 5 else request.messages
    
    # System prompt - helpful and concise
    system_prompt = """You are a helpful AI assistant. You can:
- Answer questions on any topic
- Create flash cards (format: Q: [question] A: [answer], separated by ---)
- Generate quiz questions from files
- Analyze documents, PDFs, images, and other files

Be clear, concise, and helpful. When analyzing files, focus on the key content and answer the user's questions about it."""
    
    # Add system message
    conversation.append(HumanMessage(content=system_prompt))
    
    for msg in recent_messages:
        if msg.role == 'user':
            content = msg.content
            if msg.images:
                content += "\n[Images attached]"
            conversation.append(HumanMessage(content=content))
        elif msg.role == 'assistant':
            conversation.append(AIMessage(content=msg.content))
    
    # Add file analysis if file is provided
    if request.file_data and request.file_type:
        # File data is available
        file_mime_type = request.file_type or "application/octet-stream"
        file_size_kb = len(request.file_data) / 1024
        
        # Limit file data size to prevent timeout (first 100KB of base64 = ~75KB original file)
        # This is enough for most text-based files and prevents timeouts
        max_file_data_size = 100 * 1024  # 100KB of base64 data
        file_data_sample = request.file_data[:max_file_data_size] if len(request.file_data) > max_file_data_size else request.file_data
        is_truncated = len(request.file_data) > max_file_data_size
        
        # Create file context - tell Gemini about the file
        if is_truncated:
            file_context = f"\n\n[FILE UPLOADED: {file_mime_type} ({file_size_kb:.1f} KB total, showing first {len(file_data_sample)/1024:.1f} KB). Please analyze this file based on the provided content and respond to the user's request. The file may be large, so focus on the key information from the beginning of the file.]"
        else:
            file_context = f"\n\n[FILE UPLOADED: {file_mime_type} ({file_size_kb:.1f} KB). Please analyze this file and respond to the user's request based on the file content.]"
        
        # For text-based files, try to decode and send as text
        # For binary files, send base64 sample
        if file_mime_type.startswith("text/") or file_mime_type in ["application/json", "application/xml"]:
            try:
                import base64
                # Decode base64 to get text content
                decoded_content = base64.b64decode(file_data_sample).decode('utf-8', errors='ignore')
                file_context += f"\n\nFile Content:\n{decoded_content[:50000]}"  # First 50KB of text
                if is_truncated:
                    file_context += "\n\n[Note: File content is truncated. Analyze based on available content.]"
            except Exception as e:
                print(f"Could not decode file as text: {e}")
                file_context += f"\n\n[File is binary or encoded. File type: {file_mime_type}]"
        else:
            # For binary files (PDF, images, etc.), include base64 sample
            file_context += f"\n\n[File data (base64, first portion): {file_data_sample[:10000]}...]"
            if is_truncated:
                file_context += "\n\n[Note: File is large and truncated. Please analyze based on available data.]"
        
        # Append to last user message
        if conversation and isinstance(conversation[-1], HumanMessage):
            if isinstance(conversation[-1].content, str):
                conversation[-1].content += file_context
            else:
                # Convert to string if it's structured content
                conversation[-1] = HumanMessage(content=str(conversation[-1].content) + file_context)
        else:
            conversation.append(HumanMessage(content=file_context))
    
    # Generate response - let the endpoint handle timeout
    try:
        print(f"Processing chat message with {len(conversation)} messages")
        print(f"Last user message: {conversation[-1].content[:100] if conversation else 'N/A'}...")
        response = await llm.ainvoke(conversation)
        print(f"Chat response received: {response.content[:100] if response.content else 'Empty response'}...")
        if not response.content:
            raise Exception("Empty response from AI model")
        return ChatResponse(message=response.content)
    except Exception as e:
        print(f"Error in chat processing: {str(e)}")
        import traceback
        traceback.print_exc()
        raise Exception(f"AI response failed: {str(e)}")

async def generate_flashcards(topic: str, count: int = 5) -> ChatResponse:
    """Generate flash cards for a topic - optimized for speed"""
    llm = get_chat_llm()
    
    # Optimized prompt - shorter and more direct
    prompt = f"Create {count} flash cards about {topic}. Format: Q: [question] A: [answer]. Separate with ---"
    
    try:
        import asyncio
        response = await asyncio.wait_for(
            llm.ainvoke([HumanMessage(content=prompt)]),
            timeout=10.0  # 10 second timeout for flash cards
        )
        return ChatResponse(message=response.content)
    except asyncio.TimeoutError:
        return ChatResponse(message=f"Flash card generation is taking longer than expected. Please try with fewer cards or a simpler topic.")
    except Exception as e:
        raise Exception(f"Flash card generation failed: {str(e)}")

async def generate_questions_from_file(file_data: str, file_type: str, count: int = 5) -> ChatResponse:
    """Generate questions based on uploaded file"""
    llm = get_chat_llm()
    
    prompt = f"""Based on the uploaded {file_type} file, generate {count} quiz questions.
    Format each question as:
    Question: [question]
    Options:
    A. [option1]
    B. [option2]
    C. [option3]
    D. [option4]
    Correct Answer: [letter]
    
    Separate each question with "---"
    """
    
    # Note: In production, you'd need to process the file (PDF, image, video) first
    # For now, this is a placeholder that works with text-based analysis
    
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return ChatResponse(message=response.content)

