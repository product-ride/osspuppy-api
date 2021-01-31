import { PrismaClient, Tier, User } from '@prisma/client';
import express, { Request, Response } from 'express';
import GHService from '../services/gh';

type TierRequest = {
  title: string;
  description: string;
  minAmount: string;
};

type RepositoryRequest = {
  name: string;
  ownerOrOrg: string;
  description: string;
}

type DeleteRepositoryRequest = {
  name: string;
  ownerOrOrg: string;
}

type GetTierRoutesArgs = {
  gh: GHService,
  db: PrismaClient
};

async function validateTierRequest(req: Request<{}, {}, TierRequest>, res: Response, cb: () => void) {
  const { title, description, minAmount } = req.body;

  if (!title || !description || !minAmount || isNaN(parseInt(minAmount))) {
    res.statusCode = 400;
    res.json({});
  } else {
    await cb();
  }
}

async function validateDeleteRepositoryRequest(req: Request<{}, {}, DeleteRepositoryRequest>, res: Response, cb: () => void) {
  const { name, ownerOrOrg } = req.body;

  if (!name || !ownerOrOrg) {
    res.statusCode = 400;
    res.json({});
  } else {
    await cb();
  }
}

async function validateRepositoryRequest(req: Request<{}, {}, RepositoryRequest>, res: Response, gh: GHService, cb: () => void) {
  const { name, ownerOrOrg } = req.body;
  const repoExists = await gh.repoExists(ownerOrOrg, name);

  if (!name || !ownerOrOrg) {
    res.statusCode = 400;
    res.json({});

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
    } catch(err) {
      console.log(err);

      res.statusCode = 500;
      res.json({});
    }
  });
  
  tierRoutes.post('/', async (req: Request<{}, {}, TierRequest>, res) => {
    await validateTierRequest(req, res, async () => {
      const { title, description, minAmount } = req.body;
      const user = req.user as User;
  
      try {
        const tier = await db.tier.create({
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
    
        res.statusCode = (201);
        res.json(tier);
      } catch (err) {
        console.log(err);
        
        res.statusCode = 500;
        res.json({});
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

        res.statusCode = 200;
        res.json({});
      } else {
        res.statusCode = 404;
        res.json({});
      }

    } catch(err) {
      console.log(err);

      res.statusCode = 500;
      res.json({});
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
        
        res.statusCode = 200;
        res.json({});
      } catch(err) {
        console.log(err);

        res.statusCode = 500;
        res.json({});
      }
    });
  });

  tierRoutes.put('/:id', async (req: Request<{id: string}, {}, TierRequest>, res) => {
    const tierId = req.params.id;

    await validateTierRequest(req, res, async () => {
      const { title, description, minAmount } = req.body;
      const user = req.user as User;
  
      try {
        const userInstance = await db.user.findOne({ where: { id: user.id }, include: { Tier: true } });
        const userTier = userInstance && userInstance.Tier.find(tier => tier.id === parseInt(tierId));
        
        if (userTier) {
          const tier = await db.tier.update({
            data: {
              title,
              description,
              minAmount: parseInt(minAmount)
            },
            where: {
              id: userTier.id
            }
          });

          res.statusCode = 201;
          res.json(tier);
        } else {
          res.statusCode = 404;
          res.json({});
        }
      } catch (err) {
        console.log(err);
        
        res.statusCode = 500;
        res.json({});
      }
    });
  });

  tierRoutes.post('/:id/repositories', async (req: Request<{ id: string }, {}, RepositoryRequest>, res) => {
    await validateRepositoryRequest(req, res, gh, async () => {
      try {
        const user = req.user as User;
        const tierId = req.params.id;
        const { name, ownerOrOrg, description } = req.body;

        const repo = await db.repository.upsert({
                      create: {
                        name,
                        ownerOrOrg,
                        description,
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

        res.statusCode = 200;
        res.json(repo);
      } catch (err) {
        console.log(err);

        res.sendStatus(500);
      }      
    });
  });

  tierRoutes.patch('/:id/repositories', async (req: Request<{ id: string }, {}, RepositoryRequest>, res) => {
    await validateRepositoryRequest(req, res, gh, async () => {
      try {
        const user = req.user as User;
        const { name, ownerOrOrg, description } = req.body;

        const repo = await db.repository.update({
                      data: {
                        description
                      },
                      where: {
                        userId_name_ownerOrOrg: {
                          name,
                          userId: user.id,
                          ownerOrOrg
                        }
                      }
                    });

        res.statusCode = 200;
        res.json(repo);
      } catch (err) {
        console.log(err);

        res.sendStatus(500);
      }      
    });
  });
  
  return tierRoutes;
}
