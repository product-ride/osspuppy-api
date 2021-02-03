import cors from 'cors';
import { loadConfig } from '../utils/utils';

export default function getRestrictiveCorsMiddleware() {
  const { CORS_ORIGINS, NODE_ENV } = loadConfig();
  const isProd = NODE_ENV === 'production';
  const corsDomains = CORS_ORIGINS.split(',');

  // setup cors for protected routes
  const corsMiddleware = cors({
    allowedHeaders: '*',
    methods: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
    origin: isProd? (origin, callback) => {
      if (origin && corsDomains.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }: '*'
  });

  return corsMiddleware;
}

export function getOpenCorsMiddleware() {

  // setup cors for protected routes
  const corsMiddleware = cors({
    allowedHeaders: '*',
    methods: '*',
    origin: '*'
  });

  return corsMiddleware;
}
