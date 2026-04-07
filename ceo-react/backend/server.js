const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db');

const tasksRouter = require('./routes/tasks');
const recurringRouter = require('./routes/recurring');
const scheduleRouter = require('./routes/schedule');
const reportsRouter = require('./routes/reports');
const infoSystemRouter = require('./routes/infoSystem');
const dashboardRouter = require('./routes/dashboard');
const mastersRouter = require('./routes/masters');
const usersRouter = require('./routes/users');
const companiesRouter = require('./routes/companies');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middleware: extract CompanyID from header for multi-tenancy
app.use((req, res, next) => {
  req.companyId = parseInt(req.headers['x-company-id']) || 0;
  next();
});

// Routes
app.use('/api/quick-capture', tasksRouter);
app.use('/api/recurring-tasks', recurringRouter);
app.use('/api', scheduleRouter);
app.use('/api', reportsRouter);
app.use('/api/info-system', infoSystemRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/masters', mastersRouter);
app.use('/api/auth', usersRouter);
app.use('/api/companies', companiesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`CEO Productivity API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
