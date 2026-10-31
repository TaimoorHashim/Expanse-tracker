const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');

const config = require('./config');
const pool = require('./db');
const checkOrigin = require('./middleware/checkOrigin');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const budgetsRoutes = require('./routes/budgets');
const expensesRoutes = require('./routes/expenses');
const receivedRoutes = require('./routes/received');
const debtsRoutes = require('./routes/debts');
const reportsRoutes = require('./routes/reports');
const exportRoutes = require('./routes/export');

const sessionStore = new MySQLStore({
  createDatabaseTable: false,
  clearExpired: config.env !== 'test',
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, pool);

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false // Allows dashboard inline styles/scripts for rich experience
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session management
app.use(session({
  name: 'connect.sid',
  secret: config.session.secret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: config.session.days * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production'
  }
}));

// CSRF origin validation for mutative requests
app.use(checkOrigin);

// Static files (public frontend)
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/received', receivedRoutes);
app.use('/api/debts', debtsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/export', exportRoutes);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
