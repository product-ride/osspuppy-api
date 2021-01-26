import { User } from "@prisma/client";
import jsonwebtoken from 'jsonwebtoken';
import { load } from 'ts-dotenv';
import Queue from 'bee-queue';
import db from "../db/db";
import GHService from "../services/gh";

export function generateJwtForUser(user: User) {
  const { JWT_SECRET } = loadConfig();

  return jsonwebtoken.sign(
    {
      sub: user.username,
      avatar: user.avatar,
      email: user.email,
      sponsorWebhookSecret: user.sponsorWebhookSecret
    },
    JWT_SECRET
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

export function getSponsorshipCreatedQueue() {
  const queue = new Queue('sponsors', {
    redis: {
      host: process.env.REDIS_URL || 'localhost'
    }
  });

  return queue;
}

type UpdateRepoAccessForUserArgs = {
  gh: GHService,
  sponsor: string,
  owner: string,
  amount: number
}

export async function updateRepoAccessForUser({
  gh,
  sponsor,
  owner,
  amount
}: UpdateRepoAccessForUserArgs) {
  const eligibleTiers = await db.tier.findMany({ where: { minAmount: { lte: amount }}});
  const unEligibleTiers = await db.tier.findMany({ where: { minAmount: { gt: amount }}});

  for (const eligibleTier of eligibleTiers) {
    const repos = await db.repository.findMany({ where: { tierId: eligibleTier.id } });

    for (const repo of repos) {
      await gh.addCollaborator(repo.name, owner, sponsor);

      console.log(`added ${sponsor} as collaborator to repo ${repo.name} of ${owner}`);
    }
  }

  for (const unEligibleTier of unEligibleTiers) {
    const repos = await db.repository.findMany({ where: { tierId: unEligibleTier.id } });

    for (const repo of repos) {
      await gh.removeCollaborator(repo.name, owner, sponsor);

      console.log(`removed ${sponsor} as collaborator to repo ${repo.name} of ${owner}`);
    }
  }
}
