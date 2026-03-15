# Deployment Guide: Vercel + Supabase/Neon

This guide walks you through deploying your YouTube Trending Videos Explorer to Vercel with a PostgreSQL database.

## Prerequisites

- GitHub account
- Vercel account (free tier)
- Supabase or Neon account (free tier)
- Your aggregated data ready to import

## Part 1: Set Up PostgreSQL Database

### Option A: Supabase (Recommended)

1. **Sign up at [supabase.com](https://supabase.com)**
   - Free tier: 500MB database, 2GB bandwidth

2. **Create a new project**
   - Choose a name (e.g., "youtube-analysis")
   - Set a database password (save it!)
   - Choose a region close to you

3. **Get your connection string**
   - Go to Settings → Database
   - Find "Connection string" section
   - Copy the "URI" format (starts with `postgresql://`)

4. **Create tables**
   - Go to SQL Editor
   - Copy and paste the contents of `migrations/create_tables_postgresql.sql`
   - Click "Run"

5. **Import your data**
   - Use the Table Editor or SQL Editor to import your CSV files
   - Or use `psql` command line tool

### Option B: Neon

1. **Sign up at [neon.tech](https://neon.tech)**
   - Free tier: 3GB storage, unlimited projects

2. **Create a new project**
   - Choose a name and region

3. **Get connection string**
   - Copy the connection string from the dashboard

4. **Create tables and import data** (same as Supabase)

## Part 2: Prepare Your Code for Deployment

### 1. Update CORS Configuration

The server already supports `CORS_ORIGIN` environment variable. We'll set this in Vercel.

### 2. Test Locally First

```bash
# In server directory
npm install

# Create .env file
echo "DATABASE_URL=your_connection_string_here" > .env
echo "PORT=4000" >> .env
echo "CORS_ORIGIN=http://localhost:3000" >> .env

# Test the server
npm run dev
```

Verify it connects and endpoints work.

## Part 3: Deploy to Vercel

### Step 1: Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Migrate to PostgreSQL and prepare for Vercel deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset:** Other (or Vite if detected)
   - **Root Directory:** `./` (root)
   - **Build Command:** `npm run build` (for frontend)
   - **Output Directory:** `dist`

### Step 3: Configure Environment Variables

In Vercel project settings → Environment Variables, add:

```
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
CORS_ORIGIN=https://your-app.vercel.app
NODE_ENV=production
```

#### How to Find Your DATABASE_URL:

**For Supabase:**
1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **Settings** (gear icon) → **Database**
4. Scroll down to **Connection string** section
5. Find the **URI** format (starts with `postgresql://`)
6. Copy the connection string - it will look like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
7. Replace `[YOUR-PASSWORD]` with your actual database password (the one you set when creating the project)
8. The final string should look like:
   ```
   postgresql://postgres:yourpassword123@db.abcdefghijklmnop.supabase.co:5432/postgres
   ```

**For Neon:**
1. Go to your Neon project dashboard: https://console.neon.tech
2. Select your project
3. The connection string is displayed prominently on the dashboard
4. Copy it directly - it's already in the correct format

**Important:** 
- Use your actual Supabase/Neon connection string (replace the example above)
- Update `CORS_ORIGIN` to your Vercel app URL after first deployment (you'll get this URL after deploying)
- Mark these environment variables as available for "Production", "Preview", and "Development" environments
- Make sure your connection string includes SSL parameters (`?sslmode=require` or similar)

### Step 4: Update Vercel Configuration

The `vercel.json` file should already be in your repo. Vercel will use it automatically.

### Step 5: Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Your API will be available at: `https://your-app.vercel.app/api/*`

## Part 4: Update Frontend API Base URL

After deployment, update your frontend to use the Vercel API:

### Option 1: Use Vercel's built-in proxy (Recommended)

Update `vite.config.mjs`:

```javascript
export default defineConfig({
  // ... existing config
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE || 'https://your-app.vercel.app',
        changeOrigin: true,
      }
    }
  }
});
```

### Option 2: Set environment variable

In Vercel frontend environment variables:
```
VITE_API_BASE=https://your-app.vercel.app
```

## Part 5: Deploy Frontend

The frontend can be deployed on the same Vercel project or separately:

1. **Same project:** Vercel will serve both frontend and API
2. **Separate project:** Create another Vercel project for frontend only

### For Same Project Deployment:

Vercel will automatically:
- Serve `/api/*` routes to your Express server
- Serve everything else as static files from `dist/`

Make sure your `vercel.json` is configured correctly (already done).

## Part 6: Verify Deployment

1. **Test API endpoints:**
   ```
   https://your-app.vercel.app/health
   https://your-app.vercel.app/api/tables
   https://your-app.vercel.app/api/country/top_channels?country=United States
   ```

2. **Test frontend:**
   - Open your Vercel app URL
   - Try selecting a country
   - Verify data loads correctly

## Troubleshooting

### Issue: "Cannot connect to database"
- Check `DATABASE_URL` is set correctly in Vercel
- Verify database allows connections from Vercel IPs (Supabase/Neon should allow all by default)
- Check SSL is enabled in connection string

### Issue: CORS errors
- Update `CORS_ORIGIN` in Vercel environment variables
- Make sure it matches your frontend URL exactly

### Issue: "Module not found" errors
- Ensure `server/package.json` has all dependencies
- Vercel should install them automatically, but check build logs

### Issue: API routes return 404
- Check `vercel.json` routing configuration
- Ensure routes start with `/api/`

## Cost Estimate

**Free Tier:**
- Vercel: Unlimited requests, 100GB bandwidth
- Supabase: 500MB database, 2GB bandwidth
- Neon: 3GB storage

**Total: $0/month** (for small to medium traffic)

## Next Steps

1. Set up custom domain (optional)
2. Enable analytics in Vercel
3. Set up monitoring/alerts
4. Configure automatic backups for database

## Updating Data

When you need to update your aggregated tables:

1. Download new data from Kaggle
2. Run your Python cleaning/aggregation scripts
3. Export to CSV
4. Import to Supabase/Neon using:
   - Table Editor (for small updates)
   - `psql` command line (for bulk imports)
   - Supabase/Neon dashboard import tools
