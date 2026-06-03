# UnifyOS - Required Fixes & Implementation Guide

**Status:** Documentation for remaining critical work  
**Last Updated:** June 3, 2026  
**Fixes Completed:** 3/9 (33%)

---

## Quick Reference: All Issues

| # | Issue | Severity | Status | Time |
|---|-------|----------|--------|------|
| 1 | Truncated JSX | 🔴 | ✅ FIXED | 15 min |
| 2 | Type Safety (any) | 🔴 | ✅ FIXED | 30 min |
| 3 | ThemeContext SSR | 🔴 | ✅ FIXED | 20 min |
| 4 | Incomplete API | 🔴 | ⏳ TODO | 4-6h |
| 5 | Empty API Routes | 🔴 | ⏳ TODO | 4-6h |
| 6 | Missing Auth | �� | ⏳ TODO | 2-3h |
| 7 | Orphaned Prisma | 🟡 | ⏳ TODO | 20 min |
| 8 | Env Config | 🟡 | ⏳ TODO | 30 min |
| 9 | Security Headers | 🟡 | ⏳ TODO | 1h |

---

## COMPLETED FIXES ✅

### ✅ Fix 1: Truncated JSX
**Commit:** `3ba0982`  
**Status:** DONE

Fixed incomplete JSX in dashboard and analytics pages that was causing rendering errors.

### ✅ Fix 2: Type Safety
**Commit:** `7ea9a85`  
**Status:** DONE

Replaced `any` type with explicit `WorkflowTestResponse` interface in API client.

### ✅ Fix 3: ThemeContext SSR
**Commit:** `59006f3`  
**Status:** DONE

Removed div wrapper and fixed SSR hydration mismatch by always returning ThemeContext.Provider.

---

## PENDING FIXES ⏳

### Pending #1: Implement API Server Routes

**File:** `apps/api/src/server.js`

**Current State:** Only has `/health` endpoint

**Template to Add:**

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// ============================================
// WORKFLOWS ROUTES
// ============================================

app.get('/api/workflows', async (req, res) => {
  try {
    // TODO: Query from database
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/workflows', async (req, res) => {
  try {
    const { name, trigger, actions } = req.body;
    // TODO: Create workflow in database
    res.json({ success: true, data: { id: '1', name, trigger, actions } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// APPS ROUTES
// ============================================

app.get('/api/apps', async (req, res) => {
  try {
    // TODO: Get connected apps
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// NOTIFICATIONS ROUTES
// ============================================

app.get('/api/notifications', async (req, res) => {
  try {
    // TODO: Get notifications
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ANALYTICS ROUTES
// ============================================

app.get('/api/analytics/stats', async (req, res) => {
  try {
    res.json({ 
      success: true, 
      data: {
        connectedApps: 0,
        totalApps: 8,
        activeWorkflows: 0,
        totalWorkflows: 0,
        timeSaved: 0,
        notificationsProcessed: 0,
        workflowExecutions: 0,
        lastSync: new Date().toISOString(),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error'
      : err.message
  });
});

app.listen(PORT, () => {
  console.log(`UnifyOS API running on port ${PORT}`);
});
```

**Dependencies to Add:**
```json
{
  "dependencies": {
    "express": "^4.19.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1"
  }
}
```

**Est. Time:** 4-6 hours

---

### Pending #2: Implement Frontend API Routes

**Files to Create:**

1. **`apps/frontend/pages/api/workflows/index.ts`** (POST/GET)
2. **`apps/frontend/pages/api/workflows/[id].ts`** (PATCH/DELETE)
3. **`apps/frontend/pages/api/apps/index.ts`** (GET/POST)
4. **`apps/frontend/pages/api/notifications/index.ts`** (GET/POST)
5. **`apps/frontend/pages/api/analytics/stats.ts`** (GET)

**Template for `apps/frontend/pages/api/workflows/index.ts`:**

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    switch (req.method) {
      case 'GET':
        const { data: workflows, error } = await supabase
          .from('workflows')
          .select('*')
          .eq('user_id', req.headers['x-user-id']);

        if (error) throw error;
        return res.status(200).json({ success: true, data: workflows || [] });

      case 'POST':
        const { name, trigger, actions } = req.body;
        const { data, error: createError } = await supabase
          .from('workflows')
          .insert([{
            user_id: req.headers['x-user-id'],
            name,
            trigger,
            actions,
            active: true,
            created_at: new Date().toISOString(),
          }])
          .select();

        if (createError) throw createError;
        return res.status(201).json({ success: true, data: data[0] });

      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Workflow API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
```

**Est. Time:** 4-6 hours

---

### Pending #3: Remove Orphaned Prisma Code

**Files to Update/Delete:**

1. **Delete:** `apps/frontend/lib/prisma.ts`
2. **Update:** `apps/api/package.json`
   - Remove `@prisma/client`
   - Remove `prisma`
3. **Update:** `apps/frontend/package.json`
   - Remove `@next-auth/prisma-adapter`
   - Remove `next-auth` (if using Supabase Auth)
   - Remove `prisma` from devDeps

**Commands:**
```bash
cd apps/api
npm uninstall @prisma/client prisma

cd ../frontend
npm uninstall @next-auth/prisma-adapter next-auth prisma
rm lib/prisma.ts
```

**Est. Time:** 20 minutes

---

### Pending #4: Consolidate Environment Variables

**Current Issues:**
- `.env.example` has outdated variables
- `.env.local.example` references both Supabase and NextAuth
- Conflicting database URL definitions

**Updated `.env.local.example`:**

```bash
# ============================================
# UnifyOS Environment Configuration
# ============================================

# SUPABASE (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API Configuration
NEXT_PUBLIC_API_URL=/api
NODE_ENV=development

# Optional: Email Service (Resend)
# RESEND_API_KEY=re_your_resend_api_key_here
# EMAIL_FROM="UnifyOS <noreply@yourdomain.com>"

# Optional: OAuth (if implementing NextAuth)
# NEXTAUTH_URL=http://localhost:3000
# NEXTAUTH_SECRET=$(openssl rand -base64 32)
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Actions:**
1. Delete `.env.example` (use only `.env.local.example`)
2. Update `.env.local.example` (consolidate variables)
3. Add to `.gitignore`: `.env.local`

**Est. Time:** 30 minutes

---

### Pending #5: Add Security Middleware

**Update:** `apps/api/src/server.js`

**Changes Needed:**

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});
```

**Dependencies:**
```json
{
  "dependencies": {
    "express-rate-limit": "^7.1.5"
  }
}
```

**Est. Time:** 1 hour

---

### Pending #6: Implement Authentication

**Choice 1: Supabase Auth** (Recommended)
- Already integrated via Supabase client
- Less setup required
- Built-in social auth

**Choice 2: NextAuth.js**
- More control
- Requires Prisma adapter update
- Additional configuration

**Implementation Steps:**
1. Choose authentication provider
2. Set up auth endpoints
3. Add protected routes
4. Implement login/signup UI
5. Add session management

**Est. Time:** 2-3 hours

---

## Implementation Checklist

### Completed ✅
- [x] Fix truncated JSX
- [x] Improve type safety
- [x] Fix ThemeContext SSR
- [x] Create AUDIT.md
- [x] Create FIXES_REQUIRED.md

### Next Phase ⏳
- [ ] Implement API server routes
- [ ] Implement frontend API routes
- [ ] Remove orphaned Prisma code
- [ ] Consolidate env variables
- [ ] Add security middleware
- [ ] Implement authentication
- [ ] Add test coverage
- [ ] Setup CI/CD

---

## Testing After Implementation

```bash
# Frontend
cd apps/frontend
npm install
npm run build
npm run dev

# API (separate terminal)
cd apps/api
npm install
npm run dev

# Test endpoints
curl http://localhost:3001/api/health
curl http://localhost:3000/api/health
curl http://localhost:3000/api/workflows
curl http://localhost:3000/api/apps
curl http://localhost:3000/api/analytics/stats
```

---

## Deployment Checklist

- [ ] All API routes implemented
- [ ] Authentication configured
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Security headers configured
- [ ] Tests passing
- [ ] Build succeeds
- [ ] Performance tested
- [ ] Security audit passed

---

## Total Estimated Time

| Phase | Time |
|-------|------|
| API Implementation | 4-6 hours |
| Frontend Routes | 4-6 hours |
| Cleanup & Config | 2-3 hours |
| Security | 1 hour |
| Auth | 2-3 hours |
| Testing | 2-3 hours |
| **Total** | **15-22 hours** |

---

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Express.js Guide](https://expressjs.com/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Next Action:** Start with Pending #1 (API Server Implementation)
