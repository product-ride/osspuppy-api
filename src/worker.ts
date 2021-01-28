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
const pendingSponsorJob = new CronJob(pendingSponsorJobCron, () => {
  // add jobs to update the pending sponsors
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
