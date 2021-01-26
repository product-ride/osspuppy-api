import { PrismaClient } from '@prisma/client';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import GHService from '../services/gh';
import { loadConfig } from '../utils/utils';

type GetAuthMiddlewareArgs = {
  db: PrismaClient,
  gh: GHService
};

export default function getAuthMiddleware({ db, gh }: GetAuthMiddlewareArgs) {
  const { JWT_SECRET } = loadConfig(); 

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
              if(user.ghToken) gh.updateToken(user.ghToken);

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

  return passport.authenticate('jwt', {
    session: false,
  });
}