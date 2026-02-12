# Calorie Tracker

A React + Vite calorie tracker with:

- Daily meal logging by date
- Weekly and monthly status dots
- AI calorie suggestion from ingredient text

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create local env file from example:

```bash
cp .env.example .env.local
```

3. Put your OpenAI key in `.env.local`:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

4. Start dev server:

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
```

## Notes

- Never commit `.env.local`.
- If a key was exposed, rotate it immediately and use a new one.
