import { PrismaClient } from '@prisma/client';
import express from 'express';
import GHService from '../services/gh';
import { generateJwtForUser, loadConfig } from '../utils/utils';
import { v4 as uuid } from 'uuid';

type GetAuthRoutesArgs = {
  db: PrismaClient,
  frontendURI: string;
  gh: GHService
}

export default function getAuthRoutes({ db, frontendURI, gh }: GetAuthRoutesArgs) {
  const authRoutes = express.Router();
  const { NODE_ENV } = loadConfig();
  const isProd = NODE_ENV === 'production';

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
          sponsorWebhookSecret: uuid()
        },
        update: {
          ghToken: ghAccessToken,
          name: userInfo.name || userInfo.username,
          username: userInfo.username,
          avatar: userInfo.avatar
        },
        where: {
          username: userInfo.username
        }
      });

      const token = generateJwtForUser(user);

      res.redirect(`${frontendURI}?token=${token}`);
    } catch (err) {
      res.sendStatus(500);
    }
  });

  return authRoutes;
}
