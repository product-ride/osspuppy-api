import { DoneCallback, Job } from 'bee-queue';
import db from './db/db';
import GHService from './services/gh';
import { Sponsor, SponsorshipJob, TierUpdateJob } from './types';
import { getSponsorshipQueue, getTierUpdateQueue, loadConfig, updateRepoAccessForUser } from './utils/utils';
import { CronJob } from 'cron';

const sponsorshipQueue = getSponsorshipQueue();
const tierUpdateQueue = getTierUpdateQueue();
const { NODE_ENV } = loadConfig();
const isProd = NODE_ENV === 'production';
// in production check everyday at 12:00 AM and in dev check every 5 seconds
const pendingSponsorJobCron = isProd? '0 0 * * * *': '*/5 * * * * *';
const pendingSponsorJob = new CronJob(pendingSponsorJobCron, async () => {
  // add jobs to update the pending sponsors
  const pendingTransactions = await db.pendingTransactions.findMany({
    where: {
      AND: {
        done: false,
        effectiveDate: {
          lte: new Date()
        }
      }
    }
  });

  if (pendingTransactions.length > 0) {
    console.log('Got some pending transactions');

    for (const pendingTransaction of pendingTransactions) {
      const queue = getSponsorshipQueue();

      // add the new job to the queue
      const job = queue.createJob<SponsorshipJob>({
        ownerId: pendingTransaction.ownerId,
        sponsor: pendingTransaction.sponsor,
        amount: pendingTransaction.minAmount
      });

      await job.save();

      await db.pendingTransactions.update({
        data: {
          done: true
        },
        where: {
          id: pendingTransaction.id
        }
      });

      console.log(`Added transaction ${pendingTransaction.id} to queue`);
    }
  }
});

// run the cron task
pendingSponsorJob.start();

sponsorshipQueue.process(async (job: Job<SponsorshipJob>, done: DoneCallback<any>) => {
  const { amount, ownerId, sponsor } = job.data;
  const gh = new GHService();

  try {
    const user = await db.user.findOne({
      where: {
        id: ownerId
      }
    });
  
    if (user) {
      if (user.ghToken) {
        gh.updateToken(user.ghToken);

        await updateRepoAccessForUser({
          gh,
          sponsor,
          amount,
          owner: user
        });

        done(null);
      }
      else {
        done(new Error(`No ghToken was found for user ${user.username}`));
      }
    } else {
      done(null);
    }
  } catch (err) {
    done(err); 
  }
});

tierUpdateQueue.process(async (job: Job<TierUpdateJob>, done: DoneCallback<any>) => {
  const gh = new GHService();
  const sponsorshipQueue = getSponsorshipQueue();
  try {
    const user = await db.user.findOne({
      where: {
        id: job.data.userId
      }
    });
  
    if (user) {
      if (user.ghToken) {
        gh.updateToken(user.ghToken);
  
        const sponsors = await gh.getAllSponsors();

        for (const sponsor of sponsors) {
          await sponsorshipQueue.createJob<SponsorshipJob>({
            amount: sponsor.minAmount,
            ownerId: user.id,
            sponsor: sponsor.sponsor
          }).save();
        }
      }
      else {
        done(new Error(`No ghToken was found for user ${user.username}`));
      }
    } else {
      done(null);
    }
  
    done(null);
  } catch (err) {
    done(err); 
  }
});

if (isProd) {
  console.log(`🚀 Worker is running in production mode and waiting for jobs...`);
} else {
  console.log(`🔨 Worker is running in development mode and waiting for jobs...`);
}
