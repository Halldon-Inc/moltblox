/**
 * Games router: merges all game sub-routers into a single export.
 *
 * Mount order matters: static paths (/featured, /trending) must come before
 * param routes (/:id) so Express matches them correctly.
 */

import { Router } from 'express';
import browseRouter from './browse.js';
import statsRouter from './stats.js';
import playSessionRouter from './playSession.js';
import analyticsRouter from './analytics.js';
import crudRouter from './crud.js';

const router: Router = Router();

// Browse routes first (GET /, /featured, /trending are static)
router.use(browseRouter);

// Sub-resource routes with static suffixes (/:id/stats, /:id/rate, /:id/ratings)
router.use(statsRouter);

// Play session recording (/:id/play-session, /:id/play redirect)
router.use(playSessionRouter);

// Analytics (/:id/analytics)
router.use(analyticsRouter);

// CRUD last (includes /:id catch-all GET, plus POST /, PUT /:id, DELETE /:id)
// /:id/publish is static-suffix so safe at any position
router.use(crudRouter);

export default router;
