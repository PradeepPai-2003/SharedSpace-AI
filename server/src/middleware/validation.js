const rejectUnexpected = (body, allowedKeys) => {
  const keys = Object.keys(body);
  return keys.some(key => !allowedKeys.includes(key));
};

export const validateRegister = (req, res, next) => {
  const allowedKeys = ['username', 'email', 'password'];
  if (rejectUnexpected(req.body, allowedKeys)) {
    return res.status(400).json({ success: false, message: 'Unexpected fields in request body' });
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide username, email and password' });
  }

  // Type validation to prevent MongoDB object injection
  if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid field types. Must be strings.' });
  }

  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ success: false, message: 'Username must be between 3 and 30 characters' });
  }

  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email) || email.length > 100) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email address under 100 characters' });
  }

  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ success: false, message: 'Password must be between 6 and 128 characters' });
  }

  next();
};

export const validateLogin = (req, res, next) => {
  const allowedKeys = ['email', 'password'];
  if (rejectUnexpected(req.body, allowedKeys)) {
    return res.status(400).json({ success: false, message: 'Unexpected fields in request body' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password' });
  }

  // Type validation to prevent MongoDB object injection
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid field types. Must be strings.' });
  }

  if (email.length > 100 || password.length > 128) {
    return res.status(400).json({ success: false, message: 'Email or password length exceeds limits' });
  }

  next();
};

export const validateSpace = (req, res, next) => {
  const allowedKeys = ['name', 'description', 'isPrivate', 'hasAI'];
  if (rejectUnexpected(req.body, allowedKeys)) {
    return res.status(400).json({ success: false, message: 'Unexpected fields in request body' });
  }

  const { name, description, isPrivate, hasAI } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, message: 'Space name is required' });
  }

  // Type validation to prevent MongoDB object injection
  if (typeof name !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid field types. Must be strings.' });
  }

  if (name.length > 100) {
    return res.status(400).json({ success: false, message: 'Space name cannot exceed 100 characters' });
  }

  if (description !== undefined) {
    if (typeof description !== 'string') {
      return res.status(400).json({ success: false, message: 'Description must be a string' });
    }
    if (description.length > 500) {
      return res.status(400).json({ success: false, message: 'Description cannot exceed 500 characters' });
    }
  }

  if (isPrivate !== undefined && typeof isPrivate !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isPrivate must be a boolean' });
  }

  if (hasAI !== undefined && typeof hasAI !== 'boolean') {
    return res.status(400).json({ success: false, message: 'hasAI must be a boolean' });
  }

  next();
};

export const validateMessage = (req, res, next) => {
  const allowedKeys = ['content', 'type'];
  if (rejectUnexpected(req.body, allowedKeys)) {
    return res.status(400).json({ success: false, message: 'Unexpected fields in request body' });
  }

  const { content, type } = req.body;

  if (type === 'text' && (!content || content.trim() === '')) {
    return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
  }

  // Type validation to prevent MongoDB object injection
  if (content !== undefined && typeof content !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid field types. Must be strings.' });
  }

  if (type !== undefined && typeof type !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid field types. Must be strings.' });
  }

  if (content && content.length > 5000) {
    return res.status(400).json({ success: false, message: 'Message content cannot exceed 5000 characters' });
  }

  next();
};

export const validateAIPrompt = (req, res, next) => {
  const allowedKeys = ['message'];
  if (rejectUnexpected(req.body, allowedKeys)) {
    return res.status(400).json({ success: false, message: 'Unexpected fields in request body' });
  }

  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
  }

  if (typeof message !== 'string') {
    return res.status(400).json({ success: false, message: 'Message must be a string' });
  }

  if (message.length > 5000) {
    return res.status(400).json({ success: false, message: 'Message cannot exceed 5000 characters' });
  }

  next();
};

export const validateInviteLimit = (req, res, next) => {
  const allowedKeys = ['usageLimit'];
  if (rejectUnexpected(req.body, allowedKeys)) {
    return res.status(400).json({ success: false, message: 'Unexpected fields in request body' });
  }

  const { usageLimit } = req.body;

  if (usageLimit !== undefined) {
    if (typeof usageLimit !== 'number' && typeof usageLimit !== 'string') {
      return res.status(400).json({ success: false, message: 'usageLimit must be a number or numeric string' });
    }
    const parsed = parseInt(usageLimit);
    if (isNaN(parsed)) {
      return res.status(400).json({ success: false, message: 'usageLimit must be a valid integer' });
    }
  }

  next();
};

export const validateTokenParam = (req, res, next) => {
  const { token } = req.params;
  
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    return res.status(400).json({ success: false, message: 'Invalid token format' });
  }

  next();
};

export const validateMongoIdParam = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ success: false, message: `Invalid parameter format for ${paramName}` });
    }
    next();
  };
};

export const validateUpdateUser = (req, res, next) => {
  const allowedKeys = ['displayName', 'bio', 'avatar', 'status'];
  if (rejectUnexpected(req.body, allowedKeys)) {
    return res.status(400).json({ success: false, message: 'Unexpected fields in request body' });
  }

  const { displayName, bio, avatar, status } = req.body;

  if (displayName !== undefined) {
    if (typeof displayName !== 'string') {
      return res.status(400).json({ success: false, message: 'Display name must be a string' });
    }
    if (displayName.length > 50) {
      return res.status(400).json({ success: false, message: 'Display name cannot exceed 50 characters' });
    }
  }

  if (bio !== undefined) {
    if (typeof bio !== 'string') {
      return res.status(400).json({ success: false, message: 'Bio must be a string' });
    }
    if (bio.length > 160) {
      return res.status(400).json({ success: false, message: 'Bio cannot exceed 160 characters' });
    }
  }

  if (avatar !== undefined) {
    if (typeof avatar !== 'string') {
      return res.status(400).json({ success: false, message: 'Avatar must be a string URL' });
    }
    if (avatar !== '' && !avatar.startsWith('http://') && !avatar.startsWith('https://')) {
      return res.status(400).json({ success: false, message: 'Avatar must be a valid URL' });
    }
  }

  if (status !== undefined) {
    if (typeof status !== 'string') {
      return res.status(400).json({ success: false, message: 'Status must be a string' });
    }
    if (!['online', 'offline', 'away'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
  }

  next();
};
