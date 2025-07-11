const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createDefaultAdmin() {
    try {
        const adminEmail = 'mhdsahlct@gmail.com';
        const adminPassword = 'sahl@123';
        const adminName = 'Default Admin';
        const adminContactNumber = '9999999999';

        // Check if admin already exists
        const existingAdmin = await prisma.m01_teacher.findFirst({
            where: { m01_email: adminEmail }
        });

        if (existingAdmin) {
            console.log('Admin already exists:', adminEmail);
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Create admin teacher
        const newAdmin = await prisma.m01_teacher.create({
            data: {
                m01_name: adminName,
                m01_email: adminEmail,
                m01_contact_number: adminContactNumber,
                m01_password: hashedPassword,
                m01_is_admin: true,
                m01_profile_photo: null
            }
        });

        console.log('Default admin created successfully:', newAdmin.m01_email);
    } catch (error) {
        console.error('Error creating default admin:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createDefaultAdmin();