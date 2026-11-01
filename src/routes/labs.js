// HTTP routes for the lab list.
const express = require('express');
const { requireUserApi, sendError } = require('./http');

function labRoutes({ labService }) {
  const router = express.Router();

  // GET /api/labs?date=2026-11-03
  router.get('/', requireUserApi, (req, res) => {
    try {
      res.json(labService.listWithSlots(req.query.date));
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

module.exports = { labRoutes };
