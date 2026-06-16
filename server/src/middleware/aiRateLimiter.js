import rateLimit from 'express-rate-limit';

export const aiRestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  statusCode: 429,
  message: {
    success: false,
    message: 'Too many AI requests. Please wait a minute and try again.',
  },
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

export const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 minutes
  statusCode: 429,
  message: {
    success: false,
    message: 'Too many invite link verification attempts. Please try again after 15 minutes.',
  },
  keyGenerator: (req) => req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes
  statusCode: 429,
  message: {
    success: false,
    message: 'Too many login or registration attempts. Please try again after 15 minutes.',
  },
  keyGenerator: (req) => req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});
