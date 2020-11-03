import express from 'express';
import morgan from 'morgan';
import { load } from 'ts-dotenv';

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

// setup middlewares
app.use(morgan(isProd? 'short': 'dev'));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'hello world' });
});

app.listen(PORT, () => {
  if (isProd) {
    console.log(`🚀 express API server listening at port ${PORT} in production mode`);
  } else {
    console.log(`🔨 express API server listening at port ${PORT} in development mode`);
  }
});
