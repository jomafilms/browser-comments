# Quick Start Guide

## Local Development

### 1. Install PostgreSQL (if not installed)

**macOS (using Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Or use Docker:**
```bash
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

### 2. Create Database

```bash
createdb browser_comments
```

If using Docker:
```bash
docker exec -it postgres createdb -U postgres browser_comments
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment

Update `.env.local` with your database URL:
```
DATABASE_URL=postgresql://localhost:5432/browser_comments
```

Or if using Docker with password:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/browser_comments
```

### 5. Run Dev Server

```bash
npm run dev
```

Open http://localhost:3000

The database schema will be created automatically on first use!

## Production Deployment (Vercel + Neon)

### 1. Set Up Neon Database

1. Go to [neon.tech](https://neon.tech)
2. Create account and new project
3. Copy the connection string

### 2. Deploy to Vercel

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variable:
   - Key: `DATABASE_URL`
   - Value: Your Neon connection string
4. Deploy!

### 3. Test

Visit your deployed URL and start creating comments!

## Troubleshooting

### Database Connection Error
- Make sure PostgreSQL is running
- Check your DATABASE_URL in `.env.local`
- Verify database exists: `psql -l`

### Iframe Not Loading
- Some sites block iframe embedding (X-Frame-Options)
- Try a different website or use sites you control

### Image Not Saving
- Check browser console for errors
- Verify DATABASE_URL is correct
- Check that database table was created

## Features Checklist

- [x] Load URL in iframe
- [x] Freehand drawing
- [x] Shapes (arrow, rectangle, circle)
- [x] Text annotations
- [x] 3 color options
- [x] White/transparent background
- [x] Undo
- [x] Screen capture
- [x] Save to PostgreSQL
- [x] View comments list
- [x] Group by project
- [x] Open/Resolved filter
- [x] Add follow-up notes
- [ ] User assignments (future feature)
