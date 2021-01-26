import { PrismaClient, User } from '@prisma/client';
import express, { Request, Response } from 'express';

type CreateTierRequest = {
  title: string;
  description: string;
  minAmount: string;
};

async function validateCreateTierRequest(req: Request<{}, {}, CreateTierRequest>, res: Response, cb: () => void) {
  const { title, description, minAmount } = req.body;

  if (!title || !description || !minAmount || isNaN(parseInt(minAmount))) {
    res.sendStatus(400);
  } else {
    await cb();
  }
}

export default function getTierRoutes(db: PrismaClient) {
  const tierRoutes = express.Router();

  tierRoutes.get('/', async (req, res) => {
    const user = req.user as User;
    const tiers = await db.tier.findMany({ where: { user } });
  
    res.json({ tiers });
  });
  
  tierRoutes.post('/', async (req: Request<{}, {}, CreateTierRequest>, res) => {
    await validateCreateTierRequest(req, res, async () => {
      const { title, description, minAmount } = req.body;
      const user = req.user as User;
  
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
    });
  });
  
  return tierRoutes;
}
