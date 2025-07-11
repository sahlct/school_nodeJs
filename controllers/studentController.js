const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Log audit entry for student actions
const logAudit = async (action, studentId, performedBy, changes = null) => {
    await prisma.auditLog.create({
        data: {
            action,
            student_id: studentId,
            performed_by: performedBy,
            changes,
            created_at: new Date()
        }
    });
};

exports.createStudent = [
    upload.single('m03_profile_photo'),
    async (req, res) => {
        try {
            // Check if user is admin
            if (!req.user.isAdmin) {
                return res.status(403).json({
                    error: "Admin access required"
                });
            }

            // Validate required fields
            const { m03_name, m03_contact_number, m03_email, m03_gender } = req.body;
            if (!m03_name || !m03_contact_number || !m03_email || !m03_gender) {
                return res.status(422).json({
                    error: "Name, contact number, email, and gender are required"
                });
            }

            // Validate gender
            const validGenders = ['Male', 'Female', 'Other'];
            if (!validGenders.includes(m03_gender)) {
                return res.status(422).json({
                    error: "Invalid gender. Must be Male, Female, or Other"
                });
            }

            // Check if contact number already exists
            const existingStudent = await prisma.m03_student.findFirst({
                where: { m03_contact_number }
            });
            if (existingStudent) {
                return res.status(409).json({
                    error: `Contact number ${m03_contact_number} is already in use!`
                });
            }

            // Check if email already exists
            const existingEmail = await prisma.m03_student.findFirst({
                where: { m03_email }
            });
            if (existingEmail) {
                return res.status(409).json({
                    error: `Email ${m03_email} is already in use!`
                });
            }

            // Upload image to Cloudinary if present
            let imageUrl = null;
            if (req.file) {
                const uploadPromise = () => new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { resource_type: 'image' },
                        (error, result) => {
                            if (error) return reject(error);
                            resolve(result);
                        }
                    );
                    uploadStream.end(req.file.buffer);
                });
                const uploadResult = await uploadPromise();
                imageUrl = uploadResult.secure_url;
            }

            // Prepare data for student creation
            const studentData = {
                m03_name,
                m03_contact_number,
                m03_email,
                m03_gender,
                m03_profile_photo: imageUrl
            };

            // Create new student
            const newStudent = await prisma.m03_student.create({
                data: studentData
            });

            // Log audit entry
            await logAudit('CREATE', newStudent.m03_id, req.user.userId);

            // Generate JWT token
            const token = jwt.sign(
                { userId: newStudent.m03_id, role: 'student', isAdmin: false },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );

            // Convert contact_number to string for JSON response
            const responseData = {
                ...newStudent,
                m03_contact_number: newStudent.m03_contact_number.toString(),
            };

            return res.status(201).json({
                status: "Success",
                message: "New Student Created Successfully!",
                data: responseData,
                token
            });

        } catch (error) {
            console.error('Error during student creation:', error);
            return res.status(500).json({
                error: error.message || 'An error occurred while creating the student'
            });
        }
    }
];

exports.getStudents = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const searchFilter = search ? {
            OR: [
                { m03_name: { contains: search, mode: 'insensitive' } },
                { m03_email: { contains: search, mode: 'insensitive' } },
                { m03_contact_number: { contains: search, mode: 'insensitive' } },
                { m03_gender: { contains: search, mode: 'insensitive' } }
            ]
        } : {};

        const [students, totalCount] = await Promise.all([
            prisma.m03_student.findMany({
                where: searchFilter,
                skip: skip,
                take: limitNum,
                orderBy: { created_at: 'desc' },
                include: { m03_m02_classes: { select: { m02_id: true, m02_name: true } } }
            }),
            prisma.m03_student.count({ where: searchFilter })
        ]);

        const formattedStudents = students.map(student => ({
            ...student,
            m03_contact_number: student.m03_contact_number.toString(),
            m03_password: undefined
        }));

        return res.status(200).json({
            status: "Success",
            message: "Students data fetched successfully",
            data: {
                students: formattedStudents,
                pagination: {
                    total: totalCount,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(totalCount / limitNum)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching students:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while fetching students'
        });
    }
};

exports.getSingleStudent = async (req, res) => {
    try {
        const studentId = parseInt(req.params.m03_id);

        if (isNaN(studentId)) {
            return res.status(400).json({
                error: "Invalid student ID. Must be a number."
            });
        }

        const currentStudent = await prisma.m03_student.findUnique({
            where: { m03_id: studentId },
            include: { m03_m02_classes: { select: { m02_id: true, m02_name: true } } }
        });

        if (!currentStudent) {
            return res.status(404).json({ error: "Student Not Found!" });
        }

        const responseData = {
            ...currentStudent,
            m03_contact_number: currentStudent.m03_contact_number.toString(),
            m03_password: undefined
        };

        return res.status(200).json({
            status: "Success",
            message: "Student fetched successfully",
            data: responseData
        });

    } catch (error) {
        console.error('Error fetching student:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while fetching the student'
        });
    }
};

exports.updateStudent = [
    upload.single('m03_profile_photo'),
    async (req, res) => {
        try {
            if (!req.user.isAdmin) {
                return res.status(403).json({
                    error: "Admin access required"
                });
            }

            const studentId = parseInt(req.params.m03_id);

            if (isNaN(studentId)) {
                return res.status(400).json({
                    error: "Invalid student ID. Must be a number."
                });
            }

            const existingStudent = await prisma.m03_student.findUnique({
                where: { m03_id: studentId }
            });

            if (!existingStudent) {
                return res.status(404).json({ error: "Student Not Found!" });
            }

            const { m03_name, m03_contact_number, m03_email, m03_gender } = req.body;
            if (!m03_name || !m03_contact_number || !m03_email || !m03_gender) {
                return res.status(422).json({
                    error: "Name, contact number, email, and gender are required"
                });
            }

            // Validate gender
            const validGenders = ['Male', 'Female', 'Other'];
            if (!validGenders.includes(m03_gender)) {
                return res.status(422).json({
                    error: "Invalid gender. Must be Male, Female, or Other"
                });
            }

            const existingContact = await prisma.m03_student.findFirst({
                where: {
                    m03_contact_number,
                    m03_id: { not: studentId }
                }
            });
            if (existingContact) {
                return res.status(409).json({
                    error: `Contact number ${m03_contact_number} is already in use!`
                });
            }

            const existingEmail = await prisma.m03_student.findFirst({
                where: {
                    m03_email,
                    m03_id: { not: studentId }
                }
            });
            if (existingEmail) {
                return res.status(409).json({
                    error: `Email ${m03_email} is already in use!`
                });
            }

            let imageUrl = existingStudent.m03_profile_photo;
            if (req.file) {
                const uploadPromise = () => new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { resource_type: 'image' },
                        (error, result) => {
                            if (error) return reject(error);
                            resolve(result);
                        }
                    );
                    uploadStream.end(req.file.buffer);
                });
                const uploadResult = await uploadPromise();
                imageUrl = uploadResult.secure_url;
            }

            const studentData = {
                m03_name,
                m03_contact_number,
                m03_email,
                m03_gender,
                m03_profile_photo: imageUrl
            };

            if (req.body.m03_password) {
                studentData.m03_password = await bcrypt.hash(req.body.m03_password, 10);
            }

            const changes = {
                old: {
                    m03_name: existingStudent.m03_name,
                    m03_contact_number: existingStudent.m03_contact_number,
                    m03_email: existingStudent.m03_email,
                    m03_gender: existingStudent.m03_gender,
                    m03_profile_photo: existingStudent.m03_profile_photo
                },
                new: {
                    m03_name,
                    m03_contact_number,
                    m03_email,
                    m03_gender,
                    m03_profile_photo: imageUrl
                }
            };

            const updatedStudent = await prisma.m03_student.update({
                where: { m03_id: studentId },
                data: studentData
            });

            await logAudit('UPDATE', studentId, req.user.userId, changes);

            const responseData = {
                ...updatedStudent,
                m03_contact_number: updatedStudent.m03_contact_number.toString(),
                m03_password: undefined
            };

            return res.status(200).json({
                status: "Success",
                message: "Student updated successfully!",
                data: responseData
            });

        } catch (error) {
            console.error('Error during student update:', error);
            return res.status(500).json({
                error: error.message || 'An error occurred while updating the student'
            });
        }
    }
];

exports.deleteStudent = async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({
                error: "Admin access required"
            });
        }

        const studentId = parseInt(req.params.m03_id);

        if (isNaN(studentId)) {
            return res.status(400).json({
                error: "Invalid student ID. Must be a number."
            });
        }

        const existingStudent = await prisma.m03_student.findUnique({
            where: { m03_id: studentId }
        });

        if (!existingStudent) {
            return res.status(404).json({ error: "Student Not Found!" });
        }

        await prisma.m03_student.delete({
            where: { m03_id: studentId }
        });

        await logAudit('DELETE', studentId, req.user.userId);

        return res.status(204).send();

    } catch (error) {
        console.error('Error during student deletion:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while deleting the黄学生'
        });
    }
};