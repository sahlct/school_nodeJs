const router = require('express').Router();
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middleware/authMiddleware');

// Protected routes
router.post('/', authMiddleware, studentController.createStudent);
router.get('/', authMiddleware, studentController.getStudents);
router.get('/export', authMiddleware, studentController.exportStudents);
router.post('/import', authMiddleware, studentController.importStudents);
router.get('/:m03_id', authMiddleware, studentController.getSingleStudent);
router.put('/:m03_id', authMiddleware, studentController.updateStudent);
router.delete('/:m03_id', authMiddleware, studentController.deleteStudent);

module.exports = router;