/**
 * File upload routes for Moltblox API
 * Handles avatar and game thumbnail uploads using multer with disk storage.
 * Files are stored on a Render persistent disk (/opt/render/uploads)
 * or ./uploads locally for development.
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join, extname, resolve } from 'path';
import { requireAuth } from '../middleware/auth.js';

const router: Router = Router();

// ---------------------
// Upload directory
// ---------------------

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure the upload directory exists at startup
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[Uploads] Created upload directory: ${UPLOAD_DIR}`);
}

// ---------------------
// Allowed image types
// ---------------------

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/**
 * File filter: only accept image files (jpg, png, webp).
 */
function imageFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ext = extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpg, .png, and .webp image files are allowed'));
  }
}

// ---------------------
// Multer storage config
// ---------------------

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const uniqueName = `${randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

/** Avatar upload: max 2 MB, single file */
const avatarUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

/** Thumbnail upload: max 5 MB, single file */
const thumbnailUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

// ---------------------
// Multer error handler
// ---------------------

function handleMulterError(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'PayloadTooLarge',
        message: 'File exceeds the maximum allowed size',
      });
      return;
    }
    res.status(400).json({
      error: 'BadRequest',
      message: err.message,
    });
    return;
  }

  if (err instanceof Error && err.message.includes('image files are allowed')) {
    res.status(400).json({
      error: 'BadRequest',
      message: err.message,
    });
    return;
  }

  next(err);
}

// ---------------------
// Routes
// ---------------------

/**
 * POST /uploads/avatar
 * Upload a user avatar image (max 2 MB, jpg/png/webp).
 * Requires authentication.
 */
router.post(
  '/avatar',
  requireAuth,
  avatarUpload.single('avatar'),
  handleMulterError,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'No file uploaded. Send a file in the "avatar" field.',
        });
        return;
      }

      res.status(201).json({
        filename: req.file.filename,
        url: `/api/v1/uploads/${req.file.filename}`,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /uploads/thumbnail
 * Upload a game thumbnail image (max 5 MB, jpg/png/webp).
 * Requires authentication.
 */
router.post(
  '/thumbnail',
  requireAuth,
  thumbnailUpload.single('thumbnail'),
  handleMulterError,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'No file uploaded. Send a file in the "thumbnail" field.',
        });
        return;
      }

      res.status(201).json({
        filename: req.file.filename,
        url: `/api/v1/uploads/${req.file.filename}`,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /uploads/:filename
 * Serve an uploaded file by filename. Public access (no auth required).
 */
router.get('/:filename', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename } = req.params;

    // Sanitize: only allow alphanumeric, hyphens, dots, and underscores
    if (!/^[\w\-.]+$/.test(filename)) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid filename',
      });
      return;
    }

    const filePath = resolve(join(UPLOAD_DIR, filename));

    // Check file exists before sending (sendFile handles 404 but we want a JSON error)
    if (!existsSync(filePath)) {
      res.status(404).json({
        error: 'NotFound',
        message: 'File not found',
      });
      return;
    }

    // Cache uploaded assets for 1 day
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

export default router;
