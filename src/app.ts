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

// load configurations from .env file or environmental variables
const {
  NODE_ENV,
  PORT,
  FRONTEND_URI
} = loadConfig();
const app = express();
const isProd = NODE_ENV === 'production';
const gh = new GHService();

// setup middlewares
app.use(morgan(isProd? 'short': 'dev'));
app.use(express.json());

// setup routes
app.use('/webhooks', getWebhookRoutes({ db, gh }));
app.use(getAuthRoutes({
  db,
  frontendURI: FRONTEND_URI,
  gh
}));

// setup routes that need auth protection
const protectedRoutes = express.Router();
const authMiddleware = getAuthMiddleware({ db, gh });
const corsMiddleware = getCorsMiddleware();

app.use('/api', corsMiddleware, authMiddleware, protectedRoutes);
protectedRoutes.use('/tiers', getTierRoutes({ db, gh }));

app.listen(PORT, () => {
  if (isProd) {
    console.log(`🚀 express API server listening at port ${PORT} in production mode`);
  } else {
    console.log(`🔨 express API server listening at port ${PORT} in development mode`);
  }
});
