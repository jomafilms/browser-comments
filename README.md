# Browser Comments

A simple web app for annotating web pages and providing inline feedback to developers.

## Features

- Load any URL in an iframe
- Draw annotations with pen, shapes (arrow, rectangle, circle)
- Add text notes
- Color picker (red, blue, yellow)
- Toggle white/transparent background
- Undo functionality
- Screen capture with annotations merged
- Save to PostgreSQL database
- View all comments grouped by project
- Filter by open/resolved status
- Add follow-up notes to existing comments

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Local PostgreSQL

Create a local database:

```bash
createdb browser_comments
```

### 3. Configure Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your database connection and admin secret. See `.env.example` for all available variables.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### Creating a Comment

1. Enter a project name and URL on the home page
2. Click "Start Annotating"
3. Use the toolbar to:
   - Select drawing tool (pen, arrow, rectangle, circle, text)
   - Choose color (red, blue, yellow)
   - Toggle background opacity
   - Undo last action
4. Click "Save" to capture and save the screenshot with annotations

### Viewing Comments

1. Click "View All Comments" from home or "View Comments" while annotating
2. Filter by status (All, Open, Resolved)
3. Filter by project using dropdown
4. Comments are grouped by project name
5. Click "Add Note" to add follow-up comments
6. Toggle status between Open/Resolved

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Set up Neon PostgreSQL database
4. Add `DATABASE_URL` environment variable in Vercel
5. Deploy

### Database Migration to Neon

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy connection string
4. Update `DATABASE_URL` in Vercel environment variables
5. Database schema will be created automatically on first request

## Tech Stack

- Next.js 15
- TypeScript
- Tailwind CSS
- PostgreSQL (local) / Neon (production)
- html2canvas for screen capture

## Notes

- Some websites may block iframe embedding (X-Frame-Options)
- For local testing, make sure PostgreSQL is running
- Images are stored as base64 in the database
- Text annotations are stored as JSON for easy querying
