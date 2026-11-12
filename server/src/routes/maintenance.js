import { Router } from 'express';
import { authenticatedWrite } from '../middleware/csrf.js';
import {
  getAllRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest
} from '../controllers/maintenanceController.js';

const router = Router();

// Reading is public; writing requires authentication and a CSRF token.
router.get('/', getAllRequests);
router.get('/:id', getRequest);
router.post('/', authenticatedWrite, createRequest);
router.patch('/:id', authenticatedWrite, updateRequest);
router.delete('/:id', authenticatedWrite, deleteRequest);

export default router;
