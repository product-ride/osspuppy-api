import { PrismaClient } from '@prisma/client';
import express, { Request } from 'express';
import { SponsorshipJob } from '../types';
import { getSponsorshipQueue } from '../utils/utils';

type SponsorWebHookRequest = {
  config: {
    secret: string
  },
  action: 'created' | 'cancelled' | 'edited' | 'tier_changed' | 'pending_cancellation' | 'pending_cancellation' | 'pending_tier_change',
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
  db: PrismaClient
}

const queue = getSponsorshipQueue();

export default function getWebhookRoutes({ db }: GetWebhookRoutesArgs) {
  const webhookRoutes = express.Router();

  webhookRoutes.post('/sponsor', async (req: Request<{}, {}, SponsorWebHookRequest>, res) => {
    const { config, action, tier, sponsor, effective_date } = req.body;
  
    try {
      const user = await db.user.findOne({ where: { sponsorWebhookSecret: config.secret } });
  
      if (!user) {
        // someone is fucking with us
        res.sendStatus(401);
      } else {
        switch (action) {
          case 'created': 
          case 'edited':
          case 'cancelled':
          case 'tier_changed':
          {
            // add the new job to the queue
            const job = queue.createJob<SponsorshipJob>({
              ownerId: user.id,
              sponsor: sponsor.login,
              amount: action !== 'cancelled'? parseInt(tier.monthly_price_in_dollars): 0
            });

            await job.save();
  
            res.sendStatus(200);
  
            break;
          }
          case 'pending_cancellation':
          case 'pending_tier_change':
          {
            await db.pendingTransactions.create({
              data: {
                effectiveDate: new Date(effective_date),
                sponsor: sponsor.login,
                owner: {
                  connect: {
                    id: user.id
                  }
                },
                minAmount: action === 'pending_tier_change'? parseInt(tier.monthly_price_in_dollars): 0
              }
            });

            res.sendStatus(200);

            break;
          }
          default: {
            console.log('sponshorship webhook handling not yet implemented');
            res.sendStatus(500);
          }
        }
      }
    } catch(err) {
      console.log(`unable to update repo access for user ${sponsor.login} ${err}`);
  
      res.sendStatus(500);
    }
  });

  return webhookRoutes;
}
