const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config();

exports.createClass = async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.isAdmin) {
            return res.status(403).json({
                error: "Admin access required"
            });
        }

        // Validate required fields
        const { m02_name, m02_subject, m02_year, m02_m01_teacher_id } = req.body;
        if (!m02_name || !m02_subject || !m02_year || !m02_m01_teacher_id) {
            return res.status(422).json({
                error: "Name, subject, year, and teacher ID are required"
            });
        }

        // Validate teacher ID
        const teacherId = parseInt(m02_m01_teacher_id);
        if (isNaN(teacherId)) {
            return res.status(400).json({
                error: "Invalid teacher ID. Must be a number."
            });
        }

        // Check if teacher exists
        const teacher = await prisma.m01_teacher.findUnique({
            where: { m01_id: teacherId }
        });
        if (!teacher) {
            return res.status(404).json({
                error: `Teacher with ID ${teacherId} not found`
            });
        }

        // Check if class with same name and year already exists
        const existingClass = await prisma.m02_class.findFirst({
            where: {
                m02_name,
                m02_year: parseInt(m02_year)
            }
        });
        if (existingClass) {
            return res.status(409).json({
                error: `Class ${m02_name} for year ${m02_year} already exists`
            });
        }

        // Prepare data for class creation
        const classData = {
            m02_name,
            m02_subject,
            m02_year: parseInt(m02_year),
            m02_m01_teacher_id: teacherId
        };

        // Create new class
        const newClass = await prisma.m02_class.create({
            data: classData
        });

        return res.status(201).json({
            status: "Success",
            message: "New Class Created Successfully!",
            data: newClass
        });

    } catch (error) {
        console.error('Error during class creation:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while creating the class'
        });
    }
};

exports.getClasses = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const searchFilter = search ? {
            OR: [
                { m02_name: { contains: search, mode: 'insensitive' } },
                { m02_subject: { contains: search, mode: 'insensitive' } }
            ]
        } : {};

        const [classes, totalCount] = await Promise.all([
            prisma.m02_class.findMany({
                where: searchFilter,
                skip: skip,
                take: limitNum,
                orderBy: { created_at: 'desc' },
                include: {
                    m02_m01_teacher: { select: { m01_id: true, m01_name: true } },
                    m02_m03_students: { select: { m03_id: true, m03_name: true } }
                }
            }),
            prisma.m02_class.count({ where: searchFilter })
        ]);

        return res.status(200).json({
            status: "Success",
            message: "Classes data fetched successfully",
            data: {
                classes,
                pagination: {
                    total: totalCount,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(totalCount / limitNum)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching classes:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while fetching classes'
        });
    }
};

exports.getSingleClass = async (req, res) => {
    try {
        const classId = parseInt(req.params.m02_id);

        if (isNaN(classId)) {
            return res.status(400).json({
                error: "Invalid class ID. Must be a number."
            });
        }

        const currentClass = await prisma.m02_class.findUnique({
            where: { m02_id: classId },
            include: {
                m02_m01_teacher: { select: { m01_id: true, m01_name: true } },
                m02_m03_students: { select: { m03_id: true, m03_name: true } }
            }
        });

        if (!currentClass) {
            return res.status(404).json({ error: "Class Not Found!" });
        }

        return res.status(200).json({
            status: "Success",
            message: "Class fetched successfully",
            data: currentClass
        });

    } catch (error) {
        console.error('Error fetching class:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while fetching the class'
        });
    }
};

exports.updateClass = async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({
                error: "Admin access required"
            });
        }

        const classId = parseInt(req.params.m02_id);

        if (isNaN(classId)) {
            return res.status(400).json({
                error: "Invalid class ID. Must be a number."
            });
        }

        const existingClass = await prisma.m02_class.findUnique({
            where: { m02_id: classId }
        });

        if (!existingClass) {
            return res.status(404).json({ error: "Class Not Found!" });
        }

        const { m02_name, m02_subject, m02_year, m02_m01_teacher_id } = req.body;
        if (!m02_name || !m02_subject || !m02_year || !m02_m01_teacher_id) {
            return res.status(422).json({
                error: "Name, subject, year, and teacher ID are required"
            });
        }

        const teacherId = parseInt(m02_m01_teacher_id);
        if (isNaN(teacherId)) {
            return res.status(400).json({
                error: "Invalid teacher ID. Must be a number."
            });
        }

        const teacher = await prisma.m01_teacher.findUnique({
            where: { m01_id: teacherId }
        });
        if (!teacher) {
            return res.status(404).json({
                error: `Teacher with ID ${teacherId} not found`
            });
        }

        const existingClassWithNameAndYear = await prisma.m02_class.findFirst({
            where: {
                m02_name,
                m02_year: parseInt(m02_year),
                m02_id: { not: classId }
            }
        });
        if (existingClassWithNameAndYear) {
            return res.status(409).json({
                error: `Class ${m02_name} for year ${m02_year} already exists`
            });
        }

        const classData = {
            m02_name,
            m02_subject,
            m02_year: parseInt(m02_year),
            m02_m01_teacher_id: teacherId
        };

        const updatedClass = await prisma.m02_class.update({
            where: { m02_id: classId },
            data: classData
        });

        return res.status(200).json({
            status: "Success",
            message: "Class updated successfully!",
            data: updatedClass
        });

    } catch (error) {
        console.error('Error during class update:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while updating the class'
        });
    }
};

exports.deleteClass = async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({
                error: "Admin access required"
            });
        }

        const classId = parseInt(req.params.m02_id);

        if (isNaN(classId)) {
            return res.status(400).json({
                error: "Invalid class ID. Must be a number."
            });
        }

        const existingClass = await prisma.m02_class.findUnique({
            where: { m02_id: classId }
        });

        if (!existingClass) {
            return res.status(404).json({ error: "Class Not Found!" });
        }

        await prisma.m02_class.delete({
            where: { m02_id: classId }
        });

        return res.status(204).send();

    } catch (error) {
        console.error('Error during class deletion:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while deleting the class'
        });
    }
};