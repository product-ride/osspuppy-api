import express from 'express';
import GHService from '../services/gh';
import { generateJwtForUser, loadConfig } from '../utils/utils';
import { v4 as uuid } from 'uuid';
import db from '../db/db';

export default function getAuthRoutes() {
  const authRoutes = express.Router();
  const { NODE_ENV, FRONTEND_URI } = loadConfig();
  const isProd = NODE_ENV === 'production';
  const gh = new GHService();

  // backdoor to generate usertoken in development only
  if (!isProd) {
    authRoutes.get('/token/:username', async (req, res) => {
      const username = req.params.username;

      const user = await db.user.findOne({
        where: {
          username
        }
      });

      if (user) {
        const token = generateJwtForUser(user);

        res.json({ token });
      } else {
        res.sendStatus(404);
      }
    });
  }

  authRoutes.get('/auth/github', async (req, res) => {
    const code = req.query.code as string;

    if (!code || Array.isArray(code)) {
      res.sendStatus(403);
    }

    try {
      const ghAccessToken = await gh.auth(code);
      // get user information
      const userInfo = await gh.getUserInfo();
      // save to database
      const user = await db.user.upsert({
        create: {
          name: userInfo.name || userInfo.username,
          username: userInfo.username,
          avatar: userInfo.avatar,
          email: userInfo.email,
          ghToken: ghAccessToken,
          bio: userInfo.bio,
          sponsorWebhookSecret: uuid()
        },
        update: {
          name: userInfo.name || userInfo.username,
          username: userInfo.username,
          avatar: userInfo.avatar,
          email: userInfo.email,
          ghToken: ghAccessToken,
          bio: userInfo.bio
        },
        where: {
          username: userInfo.username
        }
      });

      const token = generateJwtForUser(user);

      res.redirect(`${FRONTEND_URI}?token=${token}`);
    } catch (err) {
      console.log(err);
      
      res.sendStatus(500);
    }
  });

  return authRoutes;
}
