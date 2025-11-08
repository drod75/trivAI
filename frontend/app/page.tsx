'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { generateQuiz, generateQuizWithFile, type QuizResponse, type QuizQuestion } from '@/lib/api';

type QuizState = 'form' | 'quiz' | 'results';

type InputMethod = 'topic' | 'file';

export default function Home() {
  const [inputMethod, setInputMethod] = useState<InputMethod>('topic');
  const [prompt, setPrompt] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizState, setQuizState] = useState<QuizState>('form');

  const handleInputMethodChange = (method: InputMethod) => {
    setInputMethod(method);
    // Clear the other input when switching
    if (method === 'topic') {
      setFile(null);
      setError(null);
    } else {
      setPrompt('');
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that at least one input method is provided
    if (inputMethod === 'topic' && !prompt.trim()) {
      setError('Please enter a topic');
      return;
    }
    
    if (inputMethod === 'file' && !file) {
      setError('Please upload a file');
      return;
    }

    setLoading(true);
    setError(null);
    setQuiz(null);
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setQuizState('form');

    try {
      let result: QuizResponse;
      if (inputMethod === 'file' && file) {
        console.log('Uploading file:', file.name, 'Size:', file.size);
        // For file uploads, use the file name or a default prompt
        const filePrompt = prompt.trim() || `Generate a quiz based on the uploaded file: ${file.name}`;
        result = await generateQuizWithFile(
          { prompt: filePrompt, num_questions: numQuestions, difficulty },
          file
        );
      } else {
        result = await generateQuiz({ prompt, num_questions: numQuestions, difficulty });
      }
      setQuiz(result);
      setQuizState('quiz');
      setCurrentQuestionIndex(0);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Quiz generation error:', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to generate quiz. Please check your input and try again.';
      setError(errorMessage);
      // Don't clear the quiz state on error, just show the error
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (choice: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: choice,
    }));
  };

  const handleNextQuestion = () => {
    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Move to results
      setQuizState('results');
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleStartOver = () => {
    setQuiz(null);
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setQuizState('form');
    setError(null);
  };

  const calculateScore = () => {
    if (!quiz) return 0;
    let correct = 0;
    quiz.questions.forEach((q, index) => {
      if (selectedAnswers[index] === q.answer) {
        correct++;
      }
    });
    return correct;
  };

  const getCurrentQuestion = (): QuizQuestion | null => {
    if (!quiz || currentQuestionIndex >= quiz.questions.length) return null;
    return quiz.questions[currentQuestionIndex];
  };

  const isLastQuestion = (): boolean => {
    return quiz ? currentQuestionIndex === quiz.questions.length - 1 : false;
  };

  const hasAnsweredCurrentQuestion = (): boolean => {
    return selectedAnswers[currentQuestionIndex] !== undefined;
  };

  // Render Quiz Form
  if (quizState === 'form') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-heading">trivAI Quiz Generator</CardTitle>
              <CardDescription>
                Generate AI-powered quizzes on any topic using Gemini AI
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Quiz Form */}
          <Card>
            <CardHeader>
              <CardTitle>Create Your Quiz</CardTitle>
              <CardDescription>Choose a topic or upload a file, then customize your quiz settings</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Input Method Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-heading">Choose Input Method</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleInputMethodChange('topic')}
                      className={`
                        rounded-base border-4 border-border p-4 text-center font-heading
                        transition-all duration-200
                        ${inputMethod === 'topic'
                          ? 'bg-main text-main-foreground shadow-shadow'
                          : 'bg-secondary-background hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-shadow'
                        }
                      `}
                    >
                      📝 Enter Topic
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInputMethodChange('file')}
                      className={`
                        rounded-base border-4 border-border p-4 text-center font-heading
                        transition-all duration-200
                        ${inputMethod === 'file'
                          ? 'bg-main text-main-foreground shadow-shadow'
                          : 'bg-secondary-background hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-shadow'
                        }
                      `}
                    >
                      📄 Upload File
                    </button>
                  </div>
                </div>

                {/* Topic Input */}
                {inputMethod === 'topic' && (
                  <div className="space-y-2">
                    <label htmlFor="prompt" className="text-sm font-heading">
                      Topic *
                    </label>
                    <Input
                      id="prompt"
                      type="text"
                      placeholder="e.g., The French Revolution"
                      value={prompt}
                      onChange={(e) => {
                        setPrompt(e.target.value);
                        setError(null);
                      }}
                      required={inputMethod === 'topic'}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="num_questions" className="text-sm font-heading">
                    Number of Questions (1-10)
                  </label>
                  <Input
                    id="num_questions"
                    type="number"
                    min="1"
                    max="10"
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(parseInt(e.target.value) || 5)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="difficulty" className="text-sm font-heading">
                    Difficulty
                  </label>
                  <select
                    id="difficulty"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')}
                    className="flex h-10 w-full rounded-base border-2 border-border bg-secondary-background px-3 py-2 text-sm font-base text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    required
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                {/* File Input */}
                {inputMethod === 'file' && (
                  <div className="space-y-2">
                    <label htmlFor="file" className="text-sm font-heading">
                      Upload File *
                    </label>
                    <Input
                      id="file"
                      type="file"
                      accept=".txt,.md,.pdf,.doc,.docx,.rtf,text/*"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0] || null;
                        if (selectedFile) {
                          // Validate file size (10MB limit)
                          const maxSize = 10 * 1024 * 1024; // 10MB
                          if (selectedFile.size > maxSize) {
                            setError(`File size (${(selectedFile.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (10MB)`);
                            setFile(null);
                            e.target.value = ''; // Clear the input
                            return;
                          }
                          if (selectedFile.size === 0) {
                            setError('Selected file is empty');
                            setFile(null);
                            e.target.value = '';
                            return;
                          }
                          setError(null);
                        }
                        setFile(selectedFile);
                      }}
                      className="cursor-pointer"
                      required={inputMethod === 'file'}
                    />
                    {file && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Supported: Text files, Markdown, PDF (text only). Max size: 10MB
                    </p>
                    
                    {/* Optional topic for file-based quizzes */}
                    <div className="space-y-2 mt-4">
                      <label htmlFor="file_prompt" className="text-sm font-heading">
                        Additional Context (Optional)
                      </label>
                      <Input
                        id="file_prompt"
                        type="text"
                        placeholder="e.g., Focus on key concepts, historical events, etc."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Provide additional context to help generate more focused quiz questions
                      </p>
                    </div>
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Generating Quiz...' : 'Generate Quiz'}
                </Button>
              </form>

              {error && (
                <div className="mt-4 rounded-base border-2 border-destructive bg-destructive/10 p-4 text-destructive">
                  <p className="font-heading">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render Quiz Question (Kahoot-style)
  if (quizState === 'quiz' && quiz) {
    const currentQuestion = getCurrentQuestion();
    if (!currentQuestion) return null;

    const selectedAnswer = selectedAnswers[currentQuestionIndex];
    const colorClasses = [
      'bg-blue-500 hover:bg-blue-600',
      'bg-red-500 hover:bg-red-600',
      'bg-yellow-500 hover:bg-yellow-600',
      'bg-green-500 hover:bg-green-600'
    ];

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Progress Bar */}
        <div className="w-full bg-secondary-background border-b-2 border-border">
          <div className="max-w-4xl mx-auto px-4 py-2">
            <div className="flex items-center justify-between text-sm font-base mb-1">
              <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
              <span>{quiz.quiz_title}</span>
            </div>
            <div className="w-full bg-background rounded-full h-2 border border-border">
              <div
                className="bg-main h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Display */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-4xl space-y-8">
            {/* Question */}
            <Card className="border-4 border-border">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl md:text-4xl font-heading break-words">
                  {currentQuestion.question}
                </CardTitle>
              </CardHeader>
            </Card>

            {/* Answer Choices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentQuestion.choices.map((choice, choiceIndex) => {
                const isSelected = selectedAnswer === choice;
                return (
                  <button
                    key={choiceIndex}
                    type="button"
                    onClick={() => handleAnswerSelect(choice)}
                    disabled={!!selectedAnswer}
                    className={`
                      rounded-base border-4 border-border p-6 text-left text-lg font-base
                      transition-all duration-200 min-h-[120px] flex items-center
                      ${isSelected
                        ? `shadow-shadow scale-105 ${colorClasses[choiceIndex % colorClasses.length]} text-white`
                        : selectedAnswer
                          ? 'bg-secondary-background opacity-50 cursor-not-allowed text-foreground'
                          : `${colorClasses[choiceIndex % colorClasses.length]} hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-shadow hover:scale-[1.02] text-white`
                      }
                      disabled:cursor-not-allowed
                    `}
                  >
                    <span className="font-heading text-2xl mr-4">{String.fromCharCode(65 + choiceIndex)}.</span>
                    <span className="flex-1">{choice}</span>
                    {isSelected && (
                      <span className="ml-2 text-2xl">✓</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex justify-between gap-4">
              <Button
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0}
                variant="neutral"
                className="min-w-[120px]"
              >
                ← Previous
              </Button>
              
              <Button
                onClick={handleNextQuestion}
                disabled={!hasAnsweredCurrentQuestion()}
                className="min-w-[120px]"
              >
                {isLastQuestion() ? 'Show Results →' : 'Next →'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Results
  if (quizState === 'results' && quiz) {
    const score = calculateScore();
    const percentage = (score / quiz.questions.length) * 100;
    const isPerfect = score === quiz.questions.length;
    const isGood = percentage >= 70;
    const isPassing = percentage >= 50;

    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Results Header */}
          <Card className="border-4 border-border">
            <CardHeader className="text-center">
              <CardTitle className="text-4xl font-heading mb-4">Quiz Complete! 🎉</CardTitle>
              <div className={`text-6xl font-heading mb-4 ${isPerfect ? 'text-green-500' : isGood ? 'text-blue-500' : isPassing ? 'text-yellow-500' : 'text-red-500'}`}>
                {score} / {quiz.questions.length}
              </div>
              <CardDescription className="text-2xl">
                {percentage.toFixed(0)}% Correct
              </CardDescription>
              {isPerfect && (
                <p className="text-xl font-heading mt-4 text-green-500">Perfect Score! 🌟</p>
              )}
            </CardHeader>
          </Card>

          {/* Review Answers */}
          <Card>
            <CardHeader>
              <CardTitle>Review Your Answers</CardTitle>
              <CardDescription>See which questions you got right and wrong</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {quiz.questions.map((question: QuizQuestion, questionIndex: number) => {
                const userAnswer = selectedAnswers[questionIndex];
                const isCorrect = userAnswer === question.answer;

                return (
                  <div key={questionIndex} className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className={`text-2xl font-heading ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                        {isCorrect ? '✓' : '✗'}
                      </span>
                      <div className="flex-1">
                        <h3 className="text-lg font-heading mb-2">
                          Question {questionIndex + 1}: {question.question}
                        </h3>
                        <div className="space-y-2">
                          {question.choices.map((choice, choiceIndex) => {
                            const isUserAnswer = choice === userAnswer;
                            const isCorrectAnswer = choice === question.answer;

                            return (
                              <div
                                key={choiceIndex}
                                className={`rounded-base border-2 p-3 ${
                                  isCorrectAnswer
                                    ? 'border-green-500 bg-green-100 dark:bg-green-900'
                                    : isUserAnswer
                                      ? 'border-red-500 bg-red-100 dark:bg-red-900'
                                      : 'border-border bg-secondary-background'
                                }`}
                              >
                                <span className="font-heading">{String.fromCharCode(65 + choiceIndex)}. </span>
                                {choice}
                                {isCorrectAnswer && ' ✓ Correct Answer'}
                                {isUserAnswer && !isCorrectAnswer && ' ✗ Your Answer'}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button onClick={handleStartOver} variant="neutral" size="lg">
              Start New Quiz
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
