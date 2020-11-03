import express from 'express';
import morgan from 'morgan';
import { load } from 'ts-dotenv';
import { PrismaClient } from '@prisma/client';

// load configurations from .env file or environmental variables
const { NODE_ENV, PORT } = load({
  PORT: {
    type: Number,
    default: 8000
  },
  NODE_ENV: {
    type: [
      'production' as const,
      'development' as const,
    ],
    default: 'development'
  },
});
const app = express();
const isProd = NODE_ENV === 'production';
const prisma = new PrismaClient();

// setup middlewares
app.use(morgan(isProd? 'short': 'dev'));
app.use(express.json());

app.get('/', async (req, res) => {
  const users = await prisma.user.findMany();

  res.json({ users });
});

app.listen(PORT, () => {
  if (isProd) {
    console.log(`🚀 express API server listening at port ${PORT} in production mode`);
  } else {
    console.log(`🔨 express API server listening at port ${PORT} in development mode`);
  }
});
