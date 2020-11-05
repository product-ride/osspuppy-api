import express from 'express';
import morgan from 'morgan';
import { load } from 'ts-dotenv';
import GHService from './gh';

// load configurations from .env file or environmental variables
const { NODE_ENV, PORT, GH_CLIENT_ID, GH_CLIENT_SECRET, GH_REDIRECT_URI } = load({
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
  GH_CLIENT_ID: String,
  GH_CLIENT_SECRET: String,
  GH_REDIRECT_URI: String
});
const app = express();
const isProd = NODE_ENV === 'production';
const gh = new GHService({
  clientId: GH_CLIENT_ID,
  clientSecret: GH_CLIENT_SECRET,
  redirectURI: GH_REDIRECT_URI,
  scope: ['repo']
})

// setup middlewares
app.use(morgan(isProd? 'short': 'dev'));
app.use(express.json());

app.get('/auth/github', async (req, res) => {
  const code = req.query.code as string;

  if (!code || Array.isArray(code)) {
    res.statusCode = 403;
    res.send();
  }

  try {
    await gh.auth(code);
    const user = await gh.getUserInfo();

    res.json({ user });
  } catch (err) {
    res.statusCode = 500;
    res.end();
  }
});

app.listen(PORT, () => {
  if (isProd) {
    console.log(`🚀 express API server listening at port ${PORT} in production mode`);
  } else {
    console.log(`🔨 express API server listening at port ${PORT} in development mode`);
  }
});
