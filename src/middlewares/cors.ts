import cors from 'cors';
import { loadConfig } from '../utils/utils';

export default function getCorsMiddleware() {
  const { CORS_ORIGINS } = loadConfig();
  const corsDomains = CORS_ORIGINS.split(',');

  // setup cors for protected routes
  const corsMiddleware = cors({
    allowedHeaders: '*',
    origin: (origin, callback) => {
      if (origin && corsDomains.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  });

  return corsMiddleware;
}