const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

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

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'OK', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// ============================================
// WORKFLOWS ROUTES
// ============================================

app.get('/api/workflows', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const workflows = await prisma.workflow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: workflows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/workflows', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { name, triggerApp, triggerEvent, triggerConfig, actions } = req.body;
    const workflow = await prisma.workflow.create({
      data: {
        userId,
        name,
        triggerApp,
        triggerEvent,
        triggerConfig,
        actions,
        enabled: true
      }
    });
    res.json({ success: true, data: workflow });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// APPS ROUTES
// ============================================

app.get('/api/apps', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const appTokens = await prisma.appToken.findMany({
      where: { userId, connected: true }
    });
    res.json({ success: true, data: appTokens });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// NOTIFICATIONS ROUTES
// ============================================

app.get('/api/notifications', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ANALYTICS ROUTES
// ============================================

app.get('/api/analytics/stats', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const [appCount, workflowCount, executionCount] = await Promise.all([
      prisma.appToken.count({ where: { userId, connected: true } }),
      prisma.workflow.count({ where: { userId, enabled: true } }),
      prisma.workflowExecution.count({ 
        where: { 
          workflow: { userId },
          status: 'SUCCESS'
        } 
      })
    ]);

    res.json({ 
      success: true, 
      data: {
        connectedApps: appCount,
        totalApps: 8, // Fixed total for UI
        activeWorkflows: workflowCount,
        totalWorkflows: workflowCount,
        timeSaved: executionCount * 5, // Estimate 5 mins per execution
        notificationsProcessed: 0,
        workflowExecutions: executionCount,
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
