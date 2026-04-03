# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fliplet Data Chat — an AI chatbot that queries Fliplet data sources via a proxy API. Built with Next.js 16 (App Router), Vercel AI SDK v6, Google Gemini, and Express.

## Commands

- `npm run dev` — start dev server (Turbopack)
- `npm run build` — production build
- `npm exec -- ultracite fix` — format and lint-fix
- `npm exec -- ultracite check` — check for lint/format issues

## Environment Variables

Both stored in `.env.local` (not committed):

- `FLIPLET_API_KEY` — Fliplet REST API auth token
- `GOOGLE_GENERATIVE_AI_API_KEY` — Google Gemini API key

## Architecture

- **`app/page.tsx`** — Client component: multi-session chat UI with sidebar, launch state, framer-motion animations. Uses `useChat` from `@ai-sdk/react` with session-scoped `id`.
- **`app/api/chat/route.ts`** — Gemini chat endpoint using `streamText` with three Fliplet tools (`listDataSources`, `getDataSource`, `queryDataSource`). Returns `toUIMessageStreamResponse()`.
- **`app/api/[...path]/route.ts`** — Bridge that adapts Next.js Route Handlers to Express by constructing `IncomingMessage`/`ServerResponse` manually.
- **`lib/express-app.ts`** — Express app proxying `/api/fliplet/*` to `https://api.fliplet.com/v1` with `Auth-token` header injection.
- **`lib/sessions.ts`** — localStorage-based session CRUD for chat history persistence.
- **`app/globals.css`** — All styles (no CSS modules). Fliplet branding: `#000033` header, Poppins font, brand color spinner.

## Key Conventions

- AI SDK v6 API: `sendMessage` (not `append`), `inputSchema` (not `parameters`), `stopWhen: stepCountIs()` (not `maxSteps`), `await convertToModelMessages()`, `messages` prop on `useChat` (not `initialMessages`)
- Plain CSS classes (no Tailwind, no CSS modules)
- Biome/Ultracite for linting — run `ultracite fix` before committing
- `biome-ignore` comments used intentionally for selective `useEffect` dependency arrays

## Fliplet API

- Base: `https://api.fliplet.com/v1`
- Auth: `Auth-token` header
- Default org ID: `251686`
- Docs: https://developers.fliplet.com/REST-API-Documentation.html

# Ultracite Code Standards

This project uses **Ultracite** (Biome-based) for formatting and linting.

## Core Principles

- **Type safety**: prefer `unknown` over `any`, use const assertions, leverage type narrowing
- **Modern JS/TS**: arrow functions, `for...of`, optional chaining, template literals, destructuring, `const` by default
- **React**: function components, hooks at top level, correct dependency arrays, semantic HTML + ARIA
- **Async**: always `await` promises, use `async/await` over promise chains
- **Security**: sanitize user input, use `rel="noopener"` on external links, avoid raw HTML injection
- **Performance**: Next.js `<Image>`, specific imports, no barrel files
