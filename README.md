# wetrack

A Calamari-style time tracking web application with immutable raw logs and approval-based corrections.

## Features

- **Immutable Raw Logs**: Time sessions and break segments are append-only
- **Approval-Based Corrections**: Requests → Approvals → Adjustments workflow
- **Role-Based Access**: MEMBER, MANAGER, ADMIN roles with RLS policies
- **Audit Logging**: Every mutation creates an audit log entry
- **Server Timestamps**: All timestamps use server `now()` as source of truth

## Tech Stack

- **Frontend**: Next.js 14 App Router + TypeScript + Tailwind CSS
- **Backend**: Next.js Route Handlers
- **Database**: Supabase Postgres
- **Auth**: Supabase Auth (email + password)
- **Validation**: Zod

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up Supabase**:
   - Create a new Supabase project
   - Run the SQL schema from `supabase/schema.sql` in the Supabase SQL editor
   - Get your Supabase URL and keys from the project settings

3. **Configure environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Database Schema

The application uses the following main tables:

- `users` - User profiles
- `teams` - Teams/organizations
- `team_members` - Team membership with roles
- `time_sessions` - Clock in/out records (append-only)
- `break_segments` - Break records (append-only)
- `notes` - Notes attached to time sessions
- `requests` - Correction requests
- `adjustments` - Approved time adjustments
- `audit_logs` - Audit trail of all mutations

## API Routes

- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User signup
- `POST /api/auth/logout` - User logout
- `POST /api/time-sessions/clock-in` - Clock in
- `POST /api/time-sessions/clock-out` - Clock out
- `POST /api/breaks/start` - Start break
- `POST /api/breaks/end` - End break
- `POST /api/notes` - Create note
- `POST /api/requests` - Create request
- `PATCH /api/requests` - Review request (manager/admin)
- `POST /api/adjustments` - Create adjustment (manager/admin)
- `GET /api/timesheet` - Get timesheet data

## Pages

- `/` - Redirects to login or dashboard
- `/login` - Login page
- `/signup` - Signup page
- `/dashboard` - Member dashboard (clock in/out, timesheet, requests)
- `/admin` - Admin dashboard (review requests, view team timesheets)

## Security

- Row Level Security (RLS) policies enforce data access based on roles
- Service role key is only used in server route handlers
- All mutations are audited
- Raw logs are immutable (except clock_out_at and break_end_at updates)

## Notes

- Clock out and break end are allowed as updates to complete sessions/breaks
- All other corrections must go through the Requests → Approvals → Adjustments workflow
- Timesheets are computed by combining raw sessions, breaks, and adjustments

