const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { sensitiveLimiter } = require('../middleware/rateLimit');

router.post('/register', sensitiveLimiter, ctrl.register);
router.post('/login', sensitiveLimiter, ctrl.login);
router.post('/forgot', sensitiveLimiter, ctrl.forgot);
router.post('/reset', sensitiveLimiter, ctrl.reset);

router.get('/me', requireAuth, ctrl.me);
router.post('/logout', requireAuth, ctrl.logout);

module.exports = router;
