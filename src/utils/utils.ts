import { User } from "@prisma/client";
import jsonwebtoken from 'jsonwebtoken';
import { load } from 'ts-dotenv';

export function generateJwtForUser(user: User, jwtSecret: string) {
  return jsonwebtoken.sign(
    {
      sub: user.username
    },
    jwtSecret
  );
};

export function loadConfig() {
  return load({
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
}
