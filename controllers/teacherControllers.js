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

exports.createTeacher = [
    upload.single('m01_profile_photo'),
    async (req, res) => {
        try {
            // Validate required fields
            if (!req.body.m01_name || !req.body.m01_contact_number || !req.body.m01_email || !req.body.m01_password) {
                return res.status(422).json({
                    error: "Name, contact number, email, and password are required"
                });
            }

            // Check if contact number already exists
            const existingTeacher = await prisma.m01_teacher.findFirst({
                where: { m01_contact_number: req.body.m01_contact_number }
            });
            if (existingTeacher) {
                return res.status(409).json({
                    error: `Contact number ${req.body.m01_contact_number} is already in use!`
                });
            }

            // Check if email already exists
            const existingEmail = await prisma.m01_teacher.findFirst({
                where: { m01_email: req.body.m01_email }
            });
            if (existingEmail) {
                return res.status(409).json({
                    error: `Email ${req.body.m01_email} is already in use!`
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(req.body.m01_password, 10);

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

            // Prepare data for teacher creation
            const teacherData = {
                m01_name: req.body.m01_name,
                m01_contact_number: req.body.m01_contact_number,
                m01_email: req.body.m01_email,
                m01_password: hashedPassword,
                m01_profile_photo: imageUrl,
                m01_is_admin: req.body.m01_is_admin === 'true' || false
            };

            // Create new teacher
            const newTeacher = await prisma.m01_teacher.create({
                data: teacherData
            });

            // Generate JWT token
            const token = jwt.sign(
                { userId: newTeacher.m01_id, role: 'teacher', isAdmin: newTeacher.m01_is_admin },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );

            // Convert contact_number to string for JSON response
            const responseData = {
                ...newTeacher,
                m01_contact_number: newTeacher.m01_contact_number.toString(),
                m01_password: undefined
            };

            return res.status(201).json({
                status: "Success",
                message: "New Teacher Created Successfully!",
                data: responseData,
                token
            });

        } catch (error) {
            console.error('Error during teacher creation:', error);
            return res.status(500).json({
                error: error.message || 'An error occurred while creating the teacher'
            });
        }
    }
];

exports.getTeachers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const searchFilter = search ? {
            OR: [
                { m01_name: { contains: search, mode: 'insensitive' } },
                { m01_email: { contains: search, mode: 'insensitive' } },
                { m01_contact_number: { contains: search, mode: 'insensitive' } }
            ]
        } : {};

        const [teachers, totalCount] = await Promise.all([
            prisma.m01_teacher.findMany({
                where: searchFilter,
                skip: skip,
                take: limitNum,
                orderBy: { m01_created_at: 'desc' },
                include: { m01_classes: { select: { m02_id: true, m02_name: true } } }
            }),
            prisma.m01_teacher.count({ where: searchFilter })
        ]);

        const formattedTeachers = teachers.map(teacher => ({
            ...teacher,
            m01_contact_number: teacher.m01_contact_number.toString(),
            m01_password: undefined
        }));

        return res.status(200).json({
            status: "Success",
            message: "Teachers data fetched successfully",
            data: {
                teachers: formattedTeachers,
                pagination: {
                    total: totalCount,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(totalCount / limitNum)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching teachers:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while fetching teachers'
        });
    }
};

exports.getSingleTeacher = async (req, res) => {
    try {
        const teacherId = parseInt(req.params.m01_id);

        if (isNaN(teacherId)) {
            return res.status(400).json({
                error: "Invalid teacher ID. Must be a number."
            });
        }

        const currentTeacher = await prisma.m01_teacher.findUnique({
            where: { m01_id: teacherId },
            include: { m01_classes: { select: { m02_id: true, m02_name: true } } }
        });

        if (!currentTeacher) {
            return res.status(404).json({ error: "Teacher Not Found!" });
        }

        const responseData = {
            ...currentTeacher,
            m01_contact_number: currentTeacher.m01_contact_number.toString(),
            m01_password: undefined
        };

        return res.status(200).json({
            status: "Success",
            message: "Teacher fetched successfully",
            data: responseData
        });

    } catch (error) {
        console.error('Error fetching teacher:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while fetching the teacher'
        });
    }
};

exports.updateTeacher = [
    upload.single('m01_profile_photo'),
    async (req, res) => {
        try {
            const teacherId = parseInt(req.params.m01_id);
            const existingTeacher = await prisma.m01_teacher.findUnique({
                where: { m01_id: teacherId }
            });

            if (!existingTeacher) {
                return res.status(404).json({ error: "Teacher Not Found!" });
            }

            if (!req.body.m01_name || !req.body.m01_contact_number || !req.body.m01_email) {
                return res.status(422).json({
                    error: "Name, contact number, and email are required"
                });
            }

            const existingContact = await prisma.m01_teacher.findFirst({
                where: {
                    m01_contact_number: req.body.m01_contact_number,
                    m01_id: { not: teacherId }
                }
            });
            if (existingContact) {
                return res.status(409).json({
                    error: `Contact number ${req.body.m01_contact_number} is already in use!`
                });
            }

            const existingEmail = await prisma.m01_teacher.findFirst({
                where: {
                    m01_email: req.body.m01_email,
                    m01_id: { not: teacherId }
                }
            });
            if (existingEmail) {
                return res.status(409).json({
                    error: `Email ${req.body.m01_email} is already in use!`
                });
            }

            let imageUrl = existingTeacher.m01_profile_photo;
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

            const teacherData = {
                m01_name: req.body.m01_name,
                m01_contact_number: req.body.m01_contact_number,
                m01_email: req.body.m01_email,
                m01_profile_photo: imageUrl,
                m01_is_admin: req.body.m01_is_admin === 'true' || existingTeacher.m01_is_admin
            };

            if (req.body.m01_password) {
                teacherData.m01_password = await bcrypt.hash(req.body.m01_password, 10);
            }

            const updatedTeacher = await prisma.m01_teacher.update({
                where: { m01_id: teacherId },
                data: teacherData
            });

            const responseData = {
                ...updatedTeacher,
                m01_contact_number: updatedTeacher.m01_contact_number.toString(),
                m01_password: undefined
            };

            return res.status(200).json({
                status: "Success",
                message: "Teacher updated successfully!",
                data: responseData
            });

        } catch (error) {
            console.error('Error during teacher update:', error);
            return res.status(500).json({
                error: error.message || 'An error occurred while updating the teacher'
            });
        }
    }
];

exports.deleteTeacher = async (req, res) => {
    try {
        const teacherId = parseInt(req.params.m01_id);
        const existingTeacher = await prisma.m01_teacher.findUnique({
            where: { m01_id: teacherId }
        });

        if (!existingTeacher) {
            return res.status(404).json({ error: "Teacher Not Found!" });
        }

        await prisma.m01_teacher.delete({
            where: { m01_id: teacherId }
        });

        return res.status(204).send();

    } catch (error) {
        console.error('Error during teacher deletion:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while deleting the teacher'
        });
    }
};