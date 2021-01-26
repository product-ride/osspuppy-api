import { DoneCallback, Job } from 'bee-queue';
import db from './db/db';
import GHService from './services/gh';
import { SponsorshipCreatedJob } from './types';
import { getSponsorshipCreatedQueue, updateRepoAccessForUser } from './utils/utils';

const sponsorshipCreatedQueue = getSponsorshipCreatedQueue();
const gh = new GHService();

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
          owner: user.username,
          sponsor,
          amount
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

console.log('Worker is ready and waiting for jobs...');
