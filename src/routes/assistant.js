// HTTP route for "Find me a slot". It reads the request and returns what the assistant
// service decided. The service talks to the model; this file never does.
const express = require('express');
const { requireUserApi, sendError } = require('./http');

function assistantRoutes({ assistant }) {
  const router = express.Router();

  // POST /api/assistant/suggest  { "request": "20 seats on Thursday afternoon", "date": "2026-11-26" }
  router.post('/suggest', requireUserApi, async (req, res) => {
    try {
      res.json(await assistant.findSlots(req.body ?? {}));
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

module.exports = { assistantRoutes };