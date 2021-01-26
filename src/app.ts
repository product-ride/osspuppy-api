import express, { Request } from 'express';
import morgan from 'morgan';
import db from './db/db';
import GHService from './services/gh';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import getTierRoutes from './routes/tiers';
import getAuthRoutes from './routes/auth';
import { loadConfig } from './utils/utils';

// load configurations from .env file or environmental variables
const {
  NODE_ENV,
  JWT_SECRET,
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

app.use(getAuthRoutes({
  db,
  frontendURI: FRONTEND_URI,
  jwtSecret: JWT_SECRET,
  gh
}));

// setup routes that need auth protection
const protectedRoutes = express.Router();

app.use('/api', authMiddleware, protectedRoutes);
protectedRoutes.use('/tiers', getTierRoutes(db));

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
