import express from 'express';
import { createSpace, getSpace, getInviteLink, joinSpace, getMySpaces, pinMessage, unpinMessage, leaveSpace, deleteSpace, revokeInviteLink, regenerateInviteLink, getInviteDetails } from '../controllers/spaces.js';
import { protect } from '../middleware/auth.js';
import { validateSpace, validateInviteLimit, validateTokenParam, validateMongoIdParam } from '../middleware/validation.js';

import { inviteLimiter } from '../middleware/aiRateLimiter.js';

const router = express.Router();

router.get('/', protect, getMySpaces);
router.post('/', protect, validateSpace, createSpace);

// Static-segment routes MUST come before /:id to prevent 'invite'/'join' being caught as an ID
router.get('/invite/:token', inviteLimiter, validateTokenParam, getInviteDetails);
router.post('/join/:token', protect, inviteLimiter, validateTokenParam, joinSpace);

router.post('/:id/leave', protect, validateMongoIdParam('id'), leaveSpace);
router.delete('/:id', protect, validateMongoIdParam('id'), deleteSpace);
router.get('/:id', protect, validateMongoIdParam('id'), getSpace);
router.post('/:id/invite', protect, validateMongoIdParam('id'), validateInviteLimit, getInviteLink);
router.post('/:id/invite/revoke', protect, validateMongoIdParam('id'), revokeInviteLink);
router.post('/:id/invite/regenerate', protect, validateMongoIdParam('id'), validateInviteLimit, regenerateInviteLink);
router.put('/:id/pin', protect, validateMongoIdParam('id'), pinMessage);
router.put('/:id/unpin', protect, validateMongoIdParam('id'), unpinMessage);

export default router;

