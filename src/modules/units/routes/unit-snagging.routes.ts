import { Router } from 'express';
import { requireAuth } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validation.middleware';
import { getByUnitId } from '../../snagging/controllers/snagging.controller';
import { getSnaggingsByUnitIdSchema } from '../../snagging/dto/snagging.dto';

const router = Router({ mergeParams: true }); // Important: mergeParams to access :unitId

router.use(requireAuth);

// GET /units/:unitId/snaggings
router.get(
  '/',
  validate(getSnaggingsByUnitIdSchema),
  getByUnitId
);

export default router;