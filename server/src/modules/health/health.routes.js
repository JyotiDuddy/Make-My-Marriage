const express = require('express');
const { sendSuccess } = require('../../shared/http/responses');

const router = express.Router();

router.get('/', (req, res) => sendSuccess(res, { status: 'ok' }, { message: 'Health check passed.' }));

module.exports = router;
