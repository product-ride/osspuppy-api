import express, { Request } from 'express';
import morgan from 'morgan';
import { load } from 'ts-dotenv';
import db from './db';
import GHService from './gh';
import { v4 as uuid } from 'uuid';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import jsonwebtoken from 'jsonwebtoken';
import { User } from '@prisma/client';

// load configurations from .env file or environmental variables
const {
  NODE_ENV,
  JWT_SECRET,
  PORT,
  GH_CLIENT_ID,
  GH_CLIENT_SECRET,
  GH_REDIRECT_URI,
  FRONTEND_URI
} = load({
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
  FRONTEND_URI: String,
  JWT_SECRET: String
});
const app = express();
const isProd = NODE_ENV === 'production';
const generateJwtForUser = (user: User) => {
  return jsonwebtoken.sign(
    {
      sub: user.username
    },
    JWT_SECRET
  );
};
const gh = new GHService({
  clientId: GH_CLIENT_ID,
  clientSecret: GH_CLIENT_SECRET,
  redirectURI: GH_REDIRECT_URI,
  scope: ['repo,read:name'] //read:name to read a user's profile data.
});

// setup middlewares
app.use(morgan(isProd? 'short': 'dev'));
app.use(express.json());

// setup passport authentication
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: JWT_SECRET,
    },
    (payload, done) => {
      db.user.findOne({ where: { username: payload.sub } })
        .then((user) => {
          if (user) {
            return done(null, user);
          } else {
            return done(null, false);
          }
        })
        .catch((err) => {
          done(err, false);
        });
    }
  )
);

const authMiddleware = passport.authenticate('jwt', {
  session: false,
});

app.get('/auth/github', async (req, res) => {
  const code = req.query.code as string;

  if (!code || Array.isArray(code)) {
    res.sendStatus(403);
  }

  try {
    const ghAccessToken = await gh.auth(code);
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
          ghToken: ghAccessToken,
          sponsorWebhookSecret: uuid()
        }
      })
    }

    const token = generateJwtForUser(user);

    res.redirect(`${FRONTEND_URI}?token=${token}`);
  } catch (err) {
    res.sendStatus(500);
  }
});

app.get('/user/webhook-secret', authMiddleware, (req, res) => {
  const user = req.user as User;

  res.json({
    secret: user.sponsorWebhookSecret
  });
});

type SponsorWebHookRequest = {
  config: {
    secret: string
  },
  action: 'created' | 'cancelled' | 'edited' | 'tier_changed' | 'pending_cancellation' | 'pending_cancellation',
  effective_date: string,
  privacy_level: 'public' | 'private',
  tier: {
    monthly_price_in_dollars: string
  },
  sponsor: {
    login: string
  }
}

app.post('/webhooks/sponsor', async (req: Request<{}, {}, SponsorWebHookRequest>, res) => {
  const { config, action, tier, sponsor } = req.body;

  try {
    const user = await db.user.findOne({ where: { sponsorWebhookSecret: config.secret } });

    if (!user) {
      // someone is fucking with us
      res.sendStatus(401);
    } else {
      const eligibleTiers = await db.tier.findMany({ where: { minAmount: { lte: tier.monthly_price_in_dollars }}});

      switch (action) {
        case 'created': {
          for (const eligibleTier of eligibleTiers) {
            const repos = await db.repository.findMany({ where: { tierId: eligibleTier.id } });

            for (const repo of repos) {
              await gh.addCollaborator(repo.name, user.name, sponsor.login);

              console.log(`added ${sponsor.login} as collaborator to repo ${repo.name} of ${user.name}`);
            }
          }

          res.sendStatus(200);

          break;
        }
        default: {
          console.log('sponshorship webhook handling not yet implemented');
        }
      }
    }
  } catch {
    console.log(`unable to update repo access for user ${sponsor.login}`);

    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  if (isProd) {
    console.log(`🚀 express API server listening at port ${PORT} in production mode`);
  } else {
    console.log(`🔨 express API server listening at port ${PORT} in development mode`);
  }
});
