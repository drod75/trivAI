# trivAI Frontend

A Next.js frontend for the trivAI quiz generator application, built with React, TypeScript, Tailwind CSS, and neobrutalism.dev components.

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend API running on http://localhost:8000 (or configure `NEXT_PUBLIC_API_URL`)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure the API URL (optional):
   - The default API URL is `http://localhost:8000`
   - You can override it by setting `NEXT_PUBLIC_API_URL` in `.env.local`

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **Quiz Generation**: Generate AI-powered quizzes on any topic
- **File Upload**: Upload files to generate quizzes based on document content
- **Interactive Quiz Taking**: Take quizzes with multiple-choice questions
- **Score Tracking**: View your score and see correct/incorrect answers
- **Neobrutalism Design**: Beautiful, bold UI with neobrutalism.dev components

## Tech Stack

- **Next.js 16**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **neobrutalism.dev**: Neobrutalism design system components
- **shadcn/ui**: Component library foundation

## Project Structure

```
frontend/
├── app/                 # Next.js app directory
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Main quiz page
│   └── globals.css     # Global styles with neobrutalism utilities
├── components/         # React components
│   └── ui/            # UI components (button, card, input)
├── lib/               # Utility functions
│   ├── api.ts         # API client for backend communication
│   └── utils.ts       # Utility functions
└── public/            # Static assets
```

## API Integration

The frontend communicates with the FastAPI backend through the following endpoints:

- `GET /` - Check API status
- `POST /generate-quiz/` - Generate quiz from prompt
- `POST /generate-quiz-file/` - Generate quiz from file upload

See `lib/api.ts` for the API client implementation.

## Building for Production

```bash
npm run build
npm start
```

## Adding More Neobrutalism Components

To add more components from neobrutalism.dev:

```bash
npx shadcn@latest add https://neobrutalism.dev/r/component-name.json
```

Replace `component-name` with the desired component (e.g., `sidebar`, `dialog`, `select`).
