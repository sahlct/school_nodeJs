const router = require('express').Router();
const classController = require('../controllers/classControllers');
const authMiddleware = require('../middleware/authMiddleware');

// Protected routes
router.post('/', authMiddleware, classController.createClass);
router.get('/', authMiddleware, classController.getClasses);
router.get('/:m02_id', authMiddleware, classController.getSingleClass);
router.put('/:m02_id', authMiddleware, classController.updateClass);
router.delete('/:m02_id', authMiddleware, classController.deleteClass);

module.exports = router;