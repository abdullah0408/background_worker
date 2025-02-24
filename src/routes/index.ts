import { Router } from 'express';
import userRoutes from './api/index.js';

const router = Router();

router.use('/api', userRoutes);

export default router;
