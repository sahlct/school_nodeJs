const router = require('express').Router();
const authController = require('../controllers/authController');

// Public auth routes
router.post('/login', authController.loginUser);
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;