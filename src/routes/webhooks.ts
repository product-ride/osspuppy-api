import { PrismaClient } from '@prisma/client';
import express, { Request } from 'express';
import GHService from '../services/gh';

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

type GetWebhookRoutesArgs = {
  db: PrismaClient,
  gh: GHService
}

export default function getWebhookRoutes({ gh, db }: GetWebhookRoutesArgs) {
  const webhookRoutes = express.Router();

  webhookRoutes.post('/sponsor', async (req: Request<{}, {}, SponsorWebHookRequest>, res) => {
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

  return webhookRoutes;
}
