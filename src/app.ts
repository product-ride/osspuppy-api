import express from 'express';
import morgan from 'morgan';
import db from './db/db';
import GHService from './services/gh';
import getTierRoutes from './routes/tiers';
import getAuthRoutes from './routes/auth';
import { loadConfig } from './utils/utils';
import getWebhookRoutes from './routes/webhooks';
import getAuthMiddleware from './middlewares/auth';

// load configurations from .env file or environmental variables
const {
  NODE_ENV,
  PORT,
  GH_CLIENT_ID,
  GH_CLIENT_SECRET,
  GH_REDIRECT_URI,
  FRONTEND_URI
} = loadConfig();
const app = express();
const isProd = NODE_ENV === 'production';
const gh = new GHService({
  clientId: GH_CLIENT_ID,
  clientSecret: GH_CLIENT_SECRET,
  redirectURI: GH_REDIRECT_URI,
  scope: ['repo,read:name'] //read:name to read a user's profile data.
});

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
const authMiddleware = getAuthMiddleware(db);

app.use('/api', authMiddleware, protectedRoutes);
protectedRoutes.use('/tiers', getTierRoutes(db));

app.listen(PORT, () => {
  if (isProd) {
    console.log(`🚀 express API server listening at port ${PORT} in production mode`);
  } else {
    console.log(`🔨 express API server listening at port ${PORT} in development mode`);
  }
});
