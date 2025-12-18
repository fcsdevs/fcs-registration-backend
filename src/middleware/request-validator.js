import { ValidationError } from './error-handler.js';

export const requestValidator = (req, res, next) => {
  // Validate Content-Type for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('application/json')) {
      throw new ValidationError(
        'Content-Type must be application/json'
      );
    }
  }

  next();
};
