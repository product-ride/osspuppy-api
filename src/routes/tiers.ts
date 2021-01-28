import { PrismaClient, User } from '@prisma/client';
import express, { Request, Response } from 'express';
import GHService from '../services/gh';

type CreateTierRequest = {
  title: string;
  description: string;
  minAmount: string;
};

type AddRepositoryRequest = {
  name: string;
  ownerOrOrg: string;
}

type DeleteRepositoryRequest = {
  name: string;
  ownerOrOrg: string;
}

type GetTierRoutesArgs = {
  gh: GHService,
  db: PrismaClient
};

async function validateCreateTierRequest(req: Request<{}, {}, CreateTierRequest>, res: Response, cb: () => void) {
  const { title, description, minAmount } = req.body;

  if (!title || !description || !minAmount || isNaN(parseInt(minAmount))) {
    res.sendStatus(400);
  } else {
    await cb();
  }
}

async function validateDeleteRepositoryRequest(req: Request<{}, {}, DeleteRepositoryRequest>, res: Response, cb: () => void) {
  const { name, ownerOrOrg } = req.body;

  if (!name || !ownerOrOrg) {
    res.sendStatus(400);
  } else {
    await cb();
  }
}

async function validateAddRepositoryRequest(req: Request<{}, {}, AddRepositoryRequest>, res: Response, gh: GHService, cb: () => void) {
  const { name, ownerOrOrg } = req.body;
  const repoExists = await gh.repoExists(ownerOrOrg, name);

  if (!name || !ownerOrOrg) {
    res.sendStatus(400);

    return;
  }

  // if repo deos not exists do not entertain
  if (!repoExists) {
    res.statusCode = 404;

    res.json({
      validationErrors: ['REPO_NOT_FOUND']
    });

    return;
  }

  await cb();
}

export default function getTierRoutes({ gh, db }: GetTierRoutesArgs) {
  const tierRoutes = express.Router();

  tierRoutes.get('/', async (req, res) => {
    try {
      const user = req.user as User;
      const tiers = await db.tier.findMany({ where: { user }, include: { repositories: true } });
    
      res.json({ tiers });
    } catch {
      res.sendStatus(500);
    }
  });
  
  tierRoutes.post('/', async (req: Request<{}, {}, CreateTierRequest>, res) => {
    await validateCreateTierRequest(req, res, async () => {
      const { title, description, minAmount } = req.body;
      const user = req.user as User;
  
      try {
        await db.tier.create({
          data: {
            title,
            description,
            minAmount: parseInt(minAmount),
            user: {
              connect: {
                id: user.id
              }
            }
          }
        });
    
        res.sendStatus(201);
      } catch (err) {
        console.log(err);
        
        res.sendStatus(500);
      }
    });
  });

  tierRoutes.delete('/:id', async (req, res) => {
    const tierId = parseInt(req.params.id);

    try {
      const user = req.user as User;

      const userInstance = await db.user.findOne({
        where: { id: user.id },
        include: {
          Tier: true
        }
      });
      const tier = userInstance?.Tier.find((tier) => tier.id === tierId);

      // delete the tier only if it belongs to the user
      if (tier) {
        await db.tier.delete({
          where: {
            id: tier.id
          }
        });

        res.sendStatus(200);
      } else {
        res.sendStatus(404);
      }

    } catch(err) {
      console.log(err);

      res.sendStatus(500);
    }
  });

  tierRoutes.delete('/:id/repositories', async (req: Request<{ id: string }, {}, DeleteRepositoryRequest>, res) => {
    await validateDeleteRepositoryRequest(req, res, async () => {
      const user = req.user as User;
      const { name, ownerOrOrg } = req.body;

      try {
        await db.repository.delete({
          where: {
            userId_name_ownerOrOrg: {
              userId: user.id,
              name,
              ownerOrOrg: ownerOrOrg
            }
          }
        });
        
        res.sendStatus(200);
      } catch(err) {
        console.log(err);

        res.sendStatus(500);
      }
    });
  });

  tierRoutes.post('/:id/repositories', async (req: Request<{ id: string }, {}, AddRepositoryRequest>, res) => {
    await validateAddRepositoryRequest(req, res, gh, async () => {
      try {
        const user = req.user as User;
        const tierId = req.params.id;
        const { name, ownerOrOrg } = req.body;

        await db.repository.upsert({
          create: {
            name,
            ownerOrOrg,
            user: {
              connect: {
                id: user.id
              }
            },
            tier: {
              connect: {
                id: parseInt(tierId)
              }
            }
          },
          update: {
            tier: {
              connect: {
                id: parseInt(tierId)
              }
            }
          },
          where: {
            userId_name_ownerOrOrg: {
              name,
              userId: user.id,
              ownerOrOrg
            }
          }
        });

        res.sendStatus(201);
      } catch (err) {
        console.log(err);

        res.sendStatus(500);
      }      
    });
  });
  
  return tierRoutes;
}
