import { DoneCallback, Job } from 'bee-queue';
import db from './db/db';
import GHService from './services/gh';
import { SponsorshipCreatedJob } from './types';
import { getSponsorshipCreatedQueue, loadConfig, updateRepoAccessForUser } from './utils/utils';
import { CronJob } from 'cron';

const sponsorshipCreatedQueue = getSponsorshipCreatedQueue();
const gh = new GHService();
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
      const queue = getSponsorshipCreatedQueue();

      // add the new job to the queue
      const job = queue.createJob<SponsorshipCreatedJob>({
        ownerId: pendingTransaction.ownerId,
        sponsor: pendingTransaction.sponsor,
        amount: pendingTransaction.minAmount
      });

      job.save();

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

sponsorshipCreatedQueue.process(async (job: Job<SponsorshipCreatedJob>, done: DoneCallback<any>) => {
  const { amount, ownerId, sponsor } = job.data;

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

if (isProd) {
  console.log(`🚀 Worker is running in production mode and waiting for jobs...`);
} else {
  console.log(`🔨 Worker is running in development mode and waiting for jobs...`);
}
