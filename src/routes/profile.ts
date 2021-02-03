import db from '../db/db';
import express, { Request } from 'express';

export function getProfileRoutes() {
  const profileRoutes = express.Router();

  profileRoutes.get('/:username', async (req: Request<{username: string}>, res) => {
    const username = req.params.username;
    
    try {
      const user = await db.user.findOne({
        where: {
          username
        },
        include: {
          Tier: {
            include: {
              repositories: true
            }
          }
        }
      });

      if (user) {
        const profileDetails = {
          name: user.name,
          tiers: user.Tier,
          avatar: user.avatar
        }

        res.json({ ...profileDetails });
      } else{
        res.statusCode = 404;
        res.json({});
      }
    } catch(err) {
      console.log(err);
      res.statusCode = 500;
      res.json({});
    }
  });

  return profileRoutes;
}
