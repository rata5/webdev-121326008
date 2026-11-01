// The HTML screens. A guest is sent to sign in; a signed-in user goes to the lab list.
const path = require('node:path');
const express = require('express');

const page = (name) => path.join(__dirname, '..', 'pages', name);

function pageRoutes() {
  const router = express.Router();
  router.get('/', (req, res) => res.redirect(req.user ? '/labs' : '/signin'));
  router.get('/signin', (req, res) => (req.user ? res.redirect('/labs') : res.sendFile(page('signin.html'))));
  router.get('/labs', (req, res) => (req.user ? res.sendFile(page('labs.html')) : res.redirect('/signin')));
  return router;
}

module.exports = { pageRoutes };
