// HTTP routes for sign-up, sign-in, sign-out and "who am I".
const express = require('express');
const { sendError, setSessionCookie, clearSessionCookie } = require('./http');

function authRoutes({ auth, secret, secureCookies }) {
  const router = express.Router();

  router.post('/signup', async (req, res) => {
    try {
      const { token, user } = await auth.signUp(req.body ?? {});
      setSessionCookie(res, token, secret, secureCookies);
      res.status(201).json({ user });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/signin', async (req, res) => {
    try {
      const { token, user } = await auth.signIn(req.body ?? {});
      setSessionCookie(res, token, secret, secureCookies);
      res.json({ user });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/signout', async (req, res) => {
    await auth.signOut(req.sessionToken);
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.get('/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in first' });
    res.json({ user: req.user });
  });

  return router;
}

module.exports = { authRoutes };