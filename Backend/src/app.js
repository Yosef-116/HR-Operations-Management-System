const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const path = require('path');

const app = express();

if (env.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet({ contentSecurityPolicy: false }));  
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'HR Operations Management API is running' });
});

app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;