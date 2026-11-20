// HTTP routes for the lab list.
const express = require('express');
const { requireUserApi, sendError } = require('./http');

function labRoutes({ labService }) {
  const router = express.Router();

  // GET /api/labs?date=2026-11-03
  router.get('/', requireUserApi, async (req, res) => {
    try {
      res.json(await labService.listWithSlots(req.query.date));
    } catch (err) {
      sendError(res, err);
    }
  });

  // POST /api/labs  { "name": "Robotics Lab", "room": "1301", "capacity": 18 }  (admins only)
  router.post('/', requireUserApi, async (req, res) => {
    try {
      res.status(201).json({ lab: await labService.addLab(req.user, req.body ?? {}) });
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

module.exports = { labRoutes };