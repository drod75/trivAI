'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  images?: string[];
}

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. I can help you create flash cards, generate questions, analyze files, and much more! How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, uploadedFiles]);

  // Hide chatbot during active gameplay
  useEffect(() => {
    const checkGameState = () => {
      const gameInProgress = document.querySelector('.fixed.inset-0.z-\\[9999\\]');
      setIsGameActive(!!gameInProgress);
      if (gameInProgress && isOpen) {
        setIsOpen(false); // Close chatbot if game starts
      }
    };
    
    checkGameState();
    const interval = setInterval(checkGameState, 500);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;

    // Build user message content
    let messageContent = input.trim();
    if (uploadedFiles.length > 0 && !messageContent) {
      // If file uploaded but no message, create a default message
      messageContent = `Please analyze this file${uploadedFiles.length > 1 ? 's' : ''} and help me understand it.`;
    }
    
    const currentInput = messageContent;
    const currentFiles = [...uploadedFiles];
    
    // Create user message with file info
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3002";
      
      // Prepare file data if files are uploaded - send first file with message
      let fileData = null;
      let fileType = null;
      if (currentFiles.length > 0) {
        const file = currentFiles[0]; // Send first file
        const reader = new FileReader();
        fileData = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            try {
              const result = reader.result as string;
              const base64String = result.includes(',') ? result.split(',')[1] : result;
              resolve(base64String);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        fileType = file.type || 'application/octet-stream';
      }

      // Check if user wants flash cards - optimized detection
      const lowerInput = currentInput.toLowerCase();
      const isFlashCardRequest = lowerInput.includes('flash card') || 
                                  lowerInput.includes('flashcard') ||
                                  /(\d+)\s*flash/i.test(currentInput);
      
      if (isFlashCardRequest) {
        // Extract topic and count - faster processing
        const countMatch = currentInput.match(/(\d+)/);
        const count = countMatch ? Math.min(parseInt(countMatch[1]), 10) : 5; // Limit to 10 for speed
        const topic = currentInput.replace(/flash\s*card(s)?/gi, '').replace(/\d+/g, '').trim() || 'general knowledge';
        
        // Use AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        try {
          const response = await fetch(`${API_URL}/chat/flashcards/?topic=${encodeURIComponent(topic)}&count=${count}`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Flash card generation failed: ${response.status}`);
          }
          
          const data = await response.json();
          
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          // Clear files after successful send
          setUploadedFiles([]);
        } catch (error: any) {
          if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please try with fewer flash cards.');
          }
          throw error;
        }
      } else {
        // Regular chat - optimized with timeout
        const chatMessages = messages.slice(-4).map(msg => ({ role: msg.role, content: msg.content })); // Only last 4 messages
        chatMessages.push({ role: 'user', content: currentInput });
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 65000); // 65 second timeout to match backend
        
        try {
          // If file is attached, include it in the request
          const requestBody: any = {
            messages: chatMessages,
          };
          
          if (fileData && fileType) {
            requestBody.file_data = fileData;
            requestBody.file_type = fileType;
          }
          
          const response = await fetch(`${API_URL}/chat/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error(`Chat API error: ${response.status}`, errorText);
            throw new Error(`Chat API error: ${response.status} ${errorText}`);
          }
          
          const data = await response.json();
          console.log('Chat response received:', data);
          
          if (!data.message) {
            throw new Error('Invalid response from chat API: no message field');
          }
          
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          // Clear files after successful send
          setUploadedFiles([]);
        } catch (error: any) {
          console.error('Error in chat request:', error);
          if (error.name === 'AbortError') {
            throw new Error('Response is taking too long. Please try a shorter message.');
          }
          throw error;
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setUploadedFiles((prev) => [...prev, ...files]);
      // Clear the input so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        // TODO: Convert speech to text and send to AI
        const audioMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: '[Voice message recorded - transcription coming soon]',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, audioMessage]);
        
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Wait for recording to finish and process audio
      setTimeout(async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          setIsLoading(true);
          
          try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3002";
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.wav');
            
            const response = await fetch(`${API_URL}/chat/speech-to-text/`, {
              method: 'POST',
              body: formData,
            });
            
            if (!response.ok) {
              throw new Error(`Speech-to-text error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Add transcribed text to input
            if (data.text && !data.text.includes("coming soon")) {
              setInput(data.text);
              // Auto-send the transcribed message after a brief delay
              const sendTranscribedMessage = async () => {
                const userMessage: Message = {
                  id: Date.now().toString(),
                  role: 'user',
                  content: data.text,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, userMessage]);
                // Then send to AI
                const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3002";
                const chatMessages = [
                  ...messages.map(msg => ({ role: msg.role, content: msg.content })),
                  { role: 'user', content: data.text }
                ];
                const response = await fetch(`${API_URL}/chat/`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messages: chatMessages }),
                });
                if (response.ok) {
                  const responseData = await response.json();
                  const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: responseData.message,
                    timestamp: new Date(),
                  };
                  setMessages((prev) => [...prev, assistantMessage]);
                }
                setInput('');
              };
              setTimeout(sendTranscribedMessage, 100);
            } else {
              // If STT not implemented, show message
              const audioMessage: Message = {
                id: Date.now().toString(),
                role: 'user',
                content: '[Voice message recorded - speech-to-text coming soon. Please type your message.]',
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, audioMessage]);
            }
          } catch (error) {
            console.error('Error processing speech:', error);
            const errorMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: `Sorry, I couldn't process the audio: ${error instanceof Error ? error.message : 'Unknown error'}. Please try typing your message.`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
          } finally {
            setIsLoading(false);
            audioChunksRef.current = [];
          }
        }
      }, 500);
    }
  };

  // Don't show chatbot during active gameplay
  if (isGameActive) {
    return null;
  }

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg z-50 flex items-center justify-center"
        size="icon"
        title="Open AI Assistant"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl z-50 flex flex-col border border-slate-200 dark:border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between border-b p-4">
        <CardTitle className="text-lg font-semibold">AI Assistant</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="h-8 w-8"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                {message.images && message.images.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.images.map((img, idx) => (
                      <img key={idx} src={img} alt={`Upload ${idx + 1}`} className="rounded max-w-full" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* File upload indicator with remove buttons */}
        {uploadedFiles.length > 0 && (
          <div className="px-4 py-3 border-t bg-slate-50 dark:bg-slate-900">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Uploaded Files ({uploadedFiles.length}):
              </p>
              <div className="flex flex-col gap-2">
                {uploadedFiles.map((file, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between gap-2 bg-purple-100 dark:bg-purple-900/50 px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-purple-600 dark:text-purple-400 flex-shrink-0"
                      >
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFile(idx)}
                      className="h-6 w-6 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                      title="Remove file"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                Files will be sent with your message. Click "Send" to analyze.
              </p>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="p-4 border-t space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-10"
              title="Upload file (PDF, image, video, document)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </Button>
            <Input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.avi,.txt,.doc,.docx,.csv,.xlsx"
              multiple
            />
            <Button
              variant="outline"
              size="icon"
              onClick={isRecording ? stopRecording : startRecording}
              className={`h-10 w-10 ${isRecording ? 'bg-red-500 text-white' : ''}`}
            >
              {isRecording ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                </svg>
              )}
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Type your message..."
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)} 
              className="h-10"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </CardContent>
    </div>
  );
}

