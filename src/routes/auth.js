// HTTP routes for sign-up, sign-in (password or Google), sign-out and "who am I".
const crypto = require('node:crypto');
const express = require('express');
const { AppError } = require('../services/errors');
const { sendError, setSessionCookie, clearSessionCookie, readCookie } = require('./http');

const STATE_COOKIE = 'lb_google_state';
const GOOGLE_PATH = '/api/auth/google';
const NOT_SET_UP = 'Google sign-in is not set up on this server.';
const DID_NOT_FINISH = 'Google sign-in did not finish. Please try again.';

function authRoutes({ auth, secret, secureCookies, google = null }) {
  const router = express.Router();
  const backToSignIn = (res, message) => res.redirect(`/signin?error=${encodeURIComponent(message)}`);

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

  // GET /api/auth/google: off to Google, with a one-time state in a ten-minute cookie.
  router.get('/google', (req, res) => {
    if (!google) return backToSignIn(res, NOT_SET_UP);
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: GOOGLE_PATH, maxAge: 10 * 60 * 1000 });
    res.redirect(google.authUrl(state));
  });

  // GET /api/auth/google/callback?code=…&state=…: Google sends the browser back here.
  router.get('/google/callback', async (req, res) => {
    const expected = readCookie(req, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, { path: GOOGLE_PATH });
    if (!google) return backToSignIn(res, NOT_SET_UP);
    if (req.query.error) return backToSignIn(res, 'Google sign-in was cancelled.');
    // A callback this browser did not start is somebody trying to sign you in as them.
    if (!req.query.code || !expected || req.query.state !== expected) return backToSignIn(res, DID_NOT_FINISH);
    try {
      const { token } = await auth.signInWithGoogle(await google.profile(String(req.query.code)));
      setSessionCookie(res, token, secret, secureCookies);
      res.redirect('/labs');
    } catch (err) {
      if (err instanceof AppError) return backToSignIn(res, err.message);
      console.error(err);
      backToSignIn(res, DID_NOT_FINISH);
    }
  });

  router.get('/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in first' });
    res.json({ user: req.user });
  });

  return router;
}

module.exports = { authRoutes };