import { PrismaClient, User } from '@prisma/client';
import express, { Request, Response } from 'express';

type CreateTierRequest = {
  title: string;
  description: string;
  minAmount: string;
};

type AddRepositoryRequest = {
  name: string;
}

async function validateCreateTierRequest(req: Request<{}, {}, CreateTierRequest>, res: Response, cb: () => void) {
  const { title, description, minAmount } = req.body;

  if (!title || !description || !minAmount || isNaN(parseInt(minAmount))) {
    res.sendStatus(400);
  } else {
    await cb();
  }
}

async function validateAddRepositoryRequest(req: Request<{}, {}, AddRepositoryRequest>, res: Response, cb: () => void) {
  const { name } = req.body;

  if (!name) {
    res.sendStatus(400);
  } else {
    await cb();
  }
}

export default function getTierRoutes(db: PrismaClient) {
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
            minAmount,
            user: {
              connect: {
                id: user.id
              }
            }
          }
        });
    
        res.sendStatus(201);
      } catch {
        res.sendStatus(500);
      }
    });
  });

  tierRoutes.post('/:id/repositories', async (req: Request<{ id: string }, {}, AddRepositoryRequest>, res) => {
    await validateAddRepositoryRequest(req, res, async () => {
      try {
        const user = req.user as User;
        const tierId = req.params.id;
        const { name } = req.body;

        await db.repository.upsert({
          create: {
            name,
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
            userId_name: {
              name,
              userId: user.id
            }
          }
        });

        res.sendStatus(201);
      } catch {
        res.sendStatus(500);
      }      
    });
  });
  
  return tierRoutes;
}
