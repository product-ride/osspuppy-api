import express from 'express';
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
  scope: ['repo']
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

app.listen(PORT, () => {
  if (isProd) {
    console.log(`🚀 express API server listening at port ${PORT} in production mode`);
  } else {
    console.log(`🔨 express API server listening at port ${PORT} in development mode`);
  }
});
