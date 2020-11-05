import express from 'express';
import morgan from 'morgan';
import { load } from 'ts-dotenv';
import db from './db';
import GHService from './gh';
import { v4 as uuid } from 'uuid';

// load configurations from .env file or environmental variables
const { NODE_ENV, PORT, GH_CLIENT_ID, GH_CLIENT_SECRET, GH_REDIRECT_URI, FRONTEND_URI } = load({
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
  GH_REDIRECT_URI: String,
  FRONTEND_URI: String
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
    const token = await gh.auth(code);
    // get user information
    const userInfo = await gh.getUserInfo();
    // save to database
    let user = await db.user.findOne({
      where: {
        username: userInfo.username
      }
    });

    if (!user) {
      // create a new user
      user = await db.user.create({
        data: {
          name: userInfo.name,
          username: userInfo.username,
          avatar: userInfo.avatar,
          email: userInfo.email,
          ghToken: token,
          sponsorWebhookSecret: uuid()
        }
      })
    }

    res.redirect(FRONTEND_URI);
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
