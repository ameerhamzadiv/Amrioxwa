'use strict';

const router = require('express').Router();
const controller = require('../controllers/health.controller');

router.get('/', controller.health);
router.get('/sessions', controller.healthSessions);
router.get('/queues', controller.healthQueues);

module.exports = router;
