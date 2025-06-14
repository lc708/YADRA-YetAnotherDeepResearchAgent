# Supabase Setup Guide for YADRA

*Created: 2025-06-14*

This guide walks you through setting up Supabase for the YADRA project's artifact management system.

## Prerequisites

- A Supabase account (sign up at [supabase.com](https://supabase.com))
- Access to the YADRA repository
- Basic understanding of SQL and environment variables

## 1. Create Supabase Project

1. Log in to your Supabase dashboard
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `yadra-artifacts` (or your preferred name)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be ready (usually 1-2 minutes)

## 2. Get Project Credentials

1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (starts with `https://`)
   - **anon public** key (starts with `eyJ`)
   - **service_role** key (starts with `eyJ`) - Keep this secret!

## 3. Configure Environment Variables

### Frontend Configuration

1. Navigate to the `web/` directory in your YADRA project
2. Copy the template file:
   ```bash
   cp .env.template .env.local
   ```
3. Edit `.env.local` and update the Supabase values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### Backend Configuration (Optional)

If your backend needs to write artifacts, add to your root `.env`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 4. Initialize Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy the contents of `supabase-init.sql` from the project root
4. Paste the SQL script into the editor
5. Click "Run" to execute the script
6. Verify the setup by checking:
   - **Database** → **Tables** → You should see `artifacts` table
   - **Authentication** → **Policies** → You should see RLS policies

## 5. Enable Realtime (Important!)

1. Go to **Database** → **Replication**
2. Find the `artifacts` table
3. Toggle the switch to enable realtime for this table
4. This allows live updates in the frontend

## 6. Configure Authentication (Optional)

If you want user authentication:

1. Go to **Authentication** → **Settings**
2. Configure your preferred providers (Google, GitHub, etc.)
3. Set the **Site URL** to your production domain
4. Add **Redirect URLs**:
   - `http://localhost:3000/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)

## 7. Test the Setup

1. Start your YADRA development server:
   ```bash
   cd web
   pnpm dev
   ```
2. Navigate to `http://localhost:3000`
3. Use the HeroInput to create a research query
4. Check the workspace page to see if artifacts load
5. Verify in Supabase dashboard that data appears in the `artifacts` table

## 8. Production Deployment

### Environment Variables

Set these in your production environment (Vercel, Netlify, etc.):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Security Checklist

- ✅ RLS policies are enabled and tested
- ✅ Only necessary permissions granted to `anon` role
- ✅ `service_role` key is kept secret (not in frontend)
- ✅ Realtime is enabled only for required tables
- ✅ Authentication redirect URLs are configured correctly

## Troubleshooting

### Common Issues

**"Invalid API key" error:**
- Verify your environment variables are correct
- Check that you're using the `anon` key, not `service_role`
- Ensure `.env.local` is not committed to git

**"Row Level Security" errors:**
- Verify RLS policies are created correctly
- Check that `auth.uid()` returns the expected user ID
- Test with authenticated users

**Realtime not working:**
- Ensure realtime is enabled for the `artifacts` table
- Check browser console for WebSocket connection errors
- Verify the table is added to the `supabase_realtime` publication

**No data showing:**
- Check browser network tab for API errors
- Verify the `trace_id` parameter is being passed correctly
- Test with demo data first

### Getting Help

- Check the [Supabase documentation](https://supabase.com/docs)
- Review the YADRA project's GitHub issues
- Contact the development team

## Schema Reference

### Artifacts Table Structure

```sql
CREATE TABLE public.artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,
  node_name TEXT NOT NULL,
  type artifact_type NOT NULL, -- 'process' or 'result'
  mime TEXT NOT NULL,
  summary TEXT,
  payload_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id)
);
```

### Key Features

- **Row Level Security**: Users can only access their own artifacts
- **Realtime Updates**: Live synchronization across browser tabs
- **Type Safety**: Enum constraints for artifact types
- **Performance**: Optimized indexes for common queries
- **Audit Trail**: Automatic timestamps and user tracking

---

*This guide is part of the YADRA project documentation. For updates and issues, please refer to the project repository.*
