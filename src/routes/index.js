'use strict';

const router = require('express').Router();
const { requireApiKey } = require('../middleware/auth.middleware');
const sessionRoutes = require('./session.routes');
const healthRoutes = require('./health.routes');

router.use('/health', healthRoutes);
router.use('/sessions', requireApiKey, sessionRoutes);

module.exports = router;
