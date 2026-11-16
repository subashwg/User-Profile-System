# Portfolio Profile System

A portfolio and profile platform built in structured, verified releases.

## Step 1: Auth & Onboarding

Step 1 implements authentication (Email + Password, Google, Apple), session management, and onboarding (name and unique username).

### Tech Stack
- **Backend:** NestJS (TypeScript, Node.js 24)
- **Database & ORM:** PostgreSQL + Prisma ORM
- **Frontend:** React + TypeScript (Vite)
- **Sessions:** Secure HttpOnly Cookie Sessions
- **Testing:** Vitest + Supertest

---

## Project Structure

```text
User-profile/
├── backend/                  # NestJS backend application
│   ├── prisma/               # Prisma schema and migrations
│   ├── src/
│   │   ├── config/           # Environment validation & configuration
│   │   ├── health/           # Health check & database connection endpoints
│   │   ├── prisma/           # Prisma client service with lifecycle management
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/                 # Integration / E2E tests
│   ├── .env.example          # Environment variable template
│   └── package.json
├── frontend/                 # React frontend application (Vite)
│   ├── src/                  # React UI components
│   ├── .env.example
│   └── package.json
├── docs/                     # Specifications & dev briefs
│   └── step-1-auth.md
├── package.json              # Root workspace scripts
└── README.md
```

---

## Prerequisites

- **Node.js**: v22+ (v24 recommended)
- **npm**: v10+
- **PostgreSQL**: v14+ running locally or remotely (e.g. `postgresql://postgres:postgres@localhost:5432/user_profile`)

---

## Getting Started

### 1. Environment Configuration

Copy the example environment files for backend and frontend:

```bash
# In backend/
cp backend/.env.example backend/.env

# In frontend/
cp frontend/.env.example frontend/.env
```

Ensure your `backend/.env` has a valid `DATABASE_URL`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/user_profile?schema=public"
```

### 2. Generate Prisma Client

```bash
npm run prisma:generate
# or
cd backend && npm run prisma:generate
```

### 3. Run the Development Servers

**Run backend (NestJS):**
```bash
npm run start:backend
# or
cd backend && npm run start:dev
```
The backend starts at [http://localhost:3000](http://localhost:3000).
Check health endpoint: [http://localhost:3000/health](http://localhost:3000/health).

**Run frontend (React):**
```bash
npm run start:frontend
# or
cd frontend && npm run dev
```
The frontend starts at [http://localhost:5173](http://localhost:5173).

---

## Running Tests

### Backend Unit Tests
Runs unit tests for environment validation, controllers, and services:
```bash
npm run test:backend
# or
cd backend && npm run test
```

### Backend E2E Tests
Runs end-to-end integration tests (NestJS server lifecycle & health endpoint):
```bash
npm run test:backend:e2e
# or
cd backend && npm run test:e2e
```

### Production Build
```bash
npm run build:backend
npm run build:frontend
```
