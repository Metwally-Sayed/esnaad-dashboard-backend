import { Router } from 'express';
import { requireAuth } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validation.middleware';
import { getSnaggingsByUnit } from '../../snagging/controllers/snagging.controller';
import { getSnaggingsByUnitSchema } from '../../snagging/dto/snagging.dto';

const router = Router({ mergeParams: true }); // Important: mergeParams to access :unitId

router.use(requireAuth);

// GET /units/:unitId/snaggings
router.get(
  '/',
  validate(getSnaggingsByUnitSchema),
  getSnaggingsByUnit
);

export default router;