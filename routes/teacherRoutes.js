const router = require('express').Router();
const teacherController = require('../controllers/teacherControllers');
const authMiddleware = require('../middleware/authMiddleware');

// Protected routes
router.post('/', authMiddleware, teacherController.createTeacher);
router.get('/', authMiddleware, teacherController.getTeachers);
router.get('/:m01_id', authMiddleware, teacherController.getSingleTeacher);
router.put('/:m01_id', authMiddleware, teacherController.updateTeacher);
router.delete('/:m01_id', authMiddleware, teacherController.deleteTeacher);

module.exports = router;