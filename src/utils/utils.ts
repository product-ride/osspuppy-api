import { User } from "@prisma/client";
import jsonwebtoken from 'jsonwebtoken';
import { load } from 'ts-dotenv';
import Queue from 'bee-queue';
import db from "../db/db";
import GHService from "../services/gh";
import { TierUpdateJob } from "../types";

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
    CORS_ORIGINS: {
      type: String,
      default: 'http://localhost:3000'
    },
    GH_CLIENT_ID: String,
    GH_CLIENT_SECRET: String,
    GH_REDIRECT_URI: String,
    FRONTEND_URI: String,
    JWT_SECRET: String
  });
}

export function getSponsorshipQueue() {
  const queue = new Queue('sponsors', {
    redis: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  return queue;
}

export function getTierUpdateQueue() {
  const queue = new Queue('tier-update', {
    redis: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  return queue;
}

type UpdateRepoAccessForUserArgs = {
  gh: GHService,
  owner: User,
  sponsor: string,
  amount: number
}

export async function addTierUpdateJob(user: User) {
  const tierUpdateQueue = getTierUpdateQueue();

  await tierUpdateQueue.createJob<TierUpdateJob>({ userId: user.id }).save();
}

export async function updateRepoAccessForUser({
  gh,
  sponsor,
  amount,
  owner
}: UpdateRepoAccessForUserArgs) {
  const eligibleTiers = await db.tier.findMany({ where: { minAmount: { lte: amount }, userId: owner.id }, include: { repositories: true }});
  const unEligibleTiers = await db.tier.findMany({ where: { minAmount: { gt: amount }, userId: owner.id }, include: { repositories: true }});

  for (const eligibleTier of eligibleTiers) {
    for (const repo of eligibleTier.repositories) {
      try {
        await gh.addCollaborator(repo.name, repo.ownerOrOrg, sponsor);
        await db.transactionHistory.create({
          data: {
            action: 'ADD_COLLABORATOR',
            date: new Date(),
            repo: `${repo.ownerOrOrg}/${repo.name}`,
            sponsor,
            owner: {
              connect: {
                id: owner.id
              }
            }
          }
        });

        console.log(`added ${sponsor} as collaborator to repo ${repo.name} of ${owner.username}`);
      }
      catch(err) {
        console.log(err);
        console.log(`failed to add ${sponsor} as collaborator to repo ${repo.name} of ${owner.username}`);

        db.transactionHistory.create({
          data: {
            action: 'FAIL_ADD_COLLABORATOR',
            date: new Date(),
            repo: `${repo.ownerOrOrg}/${repo.name}`,
            sponsor,
            owner: {
              connect: {
                id: owner.id
              }
            }
          }
        })
        .then(() => null)
        .catch(() => null);
      }
    }
  }

  for (const unEligibleTier of unEligibleTiers) {
    for (const repo of unEligibleTier.repositories) {
      try {
        await gh.removeCollaborator(repo.name, repo.ownerOrOrg, sponsor);

        await db.transactionHistory.create({
          data: {
            action: 'REMOVE_COLLABORATOR',
            date: new Date(),
            repo: `${repo.ownerOrOrg}/${repo.name}`,
            sponsor,
            owner: {
              connect: {
                id: owner.id
              }
            }
          }
        });

        console.log(`removed ${sponsor} as collaborator to repo ${repo.name} of ${repo.ownerOrOrg}`);
      } catch {
        console.log(`failed to remove ${sponsor} as collaborator to repo ${repo.name} of ${repo.ownerOrOrg}`);

        db.transactionHistory.create({
          data: {
            action: 'FAIL_REMOVE_COLLABORATOR',
            date: new Date(),
            repo: `${repo.ownerOrOrg}/${repo.name}`,
            sponsor,
            owner: {
              connect: {
                id: owner.id
              }
            }
          }
        })
        .then(() => null)
        .catch(() => null);
      }
    }
  }
}
