import { Router } from 'express';
import generateCourseLayoutRoutes from './generateCourseLayout.js';

const router = Router();

router.use('/generate-course-layout', generateCourseLayoutRoutes);

export default router;
