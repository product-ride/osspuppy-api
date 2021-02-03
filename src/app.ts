import express from 'express';
import morgan from 'morgan';
import db from './db/db';
import GHService from './services/gh';
import getTierRoutes from './routes/tiers';
import getAuthRoutes from './routes/auth';
import { loadConfig } from './utils/utils';
import getWebhookRoutes from './routes/webhooks';
import getAuthMiddleware from './middlewares/auth';
import getCorsMiddleware from './middlewares/cors';
import { getProfileRoutes } from './routes/profile';

// load configurations from .env file or environmental variables
const {
  NODE_ENV,
  PORT,
} = loadConfig();
const app = express();
const isProd = NODE_ENV === 'production';
const corsMiddleware = getCorsMiddleware();

// setup middlewares
app.use(morgan(isProd? 'short': 'dev'));
app.use(express.json());

// setup routes
app.use('/webhooks', getWebhookRoutes());
app.use(getAuthRoutes());
app.use('/profile', corsMiddleware, getProfileRoutes());

// setup routes that need auth protection
const protectedRoutes = express.Router();
const authMiddleware = getAuthMiddleware();

app.use('/api', corsMiddleware, authMiddleware, protectedRoutes);
protectedRoutes.use('/tiers', getTierRoutes());

app.listen(PORT, () => {
  if (isProd) {
    console.log(`🚀 express API server listening at port ${PORT} in production mode`);
  } else {
    console.log(`🔨 express API server listening at port ${PORT} in development mode`);
  }
});
