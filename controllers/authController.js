const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

// Configure nodemailer for SMTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
    }
});

// Test SMTP connection
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP configuration error:', error);
    } else {
        console.log('SMTP server is ready to send emails');
    }
});

// Generate 6-digit OTP
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOtpEmail = async (email, otp) => {
    try {
        const mailOptions = {
            from: `"Your App Name" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: 'Your OTP for Login',
            text: `Your one-time password (OTP) is ${otp}. It is valid for 5 minutes.`,
            html: `<p>Your one-time password (OTP) is <b>${otp}</b>. It is valid for 5 minutes.</p>`
        };

        await transporter.sendMail(mailOptions);
        console.log(`OTP sent to ${email}`);
    } catch (error) {
        console.error(`Failed to send OTP to ${email}:`, error);
        throw new Error('Failed to send OTP email');
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { m01_email, m01_password } = req.body;

        // Validate required fields
        if (!m01_email || !m01_password) {
            return res.status(422).json({
                error: "Email and password are required"
            });
        }

        // Check teacher model
        let user = await prisma.m01_teacher.findFirst({
            where: { m01_email }
        });

        let role = 'teacher';
        let isAdmin = false;

        // If not found in teacher, check student model
        if (!user) {
            user = await prisma.m03_student.findFirst({
                where: { m03_email: m01_email }
            });
            role = 'student';
        }

        if (!user) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(m01_password, user.m01_password || user.m03_password);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        // Check admin status for teachers
        if (role === 'teacher') {
            isAdmin = user.m01_is_admin;
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.m01_id || user.m03_id, role, isAdmin },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Prepare response data
        const responseData = {
            id: user.m01_id || user.m03_id,
            name: user.m01_name || user.m03_name,
            email: user.m01_email || user.m03_email,
            contact_number: (user.m01_contact_number || user.m03_contact_number).toString(),
            isAdmin,
            role
        };

        return res.status(200).json({
            status: "Success",
            message: "Login successful",
            data: responseData,
            token
        });

    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred during login'
        });
    }
};

exports.sendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        // Validate required field
        if (!email) {
            return res.status(422).json({
                error: "Email is required"
            });
        }

        // Check if user exists in teacher or student model
        let user = await prisma.m01_teacher.findFirst({
            where: { m01_email: email }
        });

        if (!user) {
            user = await prisma.m03_student.findFirst({
                where: { m03_email: email }
            });
        }

        if (!user) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        // Generate and store OTP
        const otp = generateOtp();
        const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes
        otpStore.set(email, { otp, expiry });

        // Send OTP via email
        await sendOtpEmail(email, otp);

        return res.status(200).json({
            status: "Success",
            message: "OTP sent to your email"
        });

    } catch (error) {
        console.error('Error sending OTP:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while sending OTP'
        });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        // Validate required fields
        if (!email || !otp) {
            return res.status(422).json({
                error: "Email and OTP are required"
            });
        }

        // Check stored OTP
        const storedOtpData = otpStore.get(email);
        if (!storedOtpData) {
            return res.status(400).json({
                error: "OTP not found or expired"
            });
        }

        const { otp: storedOtp, expiry } = storedOtpData;

        // Check if OTP is expired
        if (Date.now() > expiry) {
            otpStore.delete(email);
            return res.status(400).json({
                error: "OTP has expired"
            });
        }

        // Verify OTP
        if (otp !== storedOtp) {
            return res.status(400).json({
                error: "Invalid OTP"
            });
        }

        // OTP is valid, delete it (one-time use)
        otpStore.delete(email);

        // Find user in teacher or student model
        let user = await prisma.m01_teacher.findFirst({
            where: { m01_email: email }
        });

        let role = 'teacher';
        let isAdmin = false;

        // If not found in teacher, check student model
        if (!user) {
            user = await prisma.m03_student.findFirst({
                where: { m03_email: email }
            });
            role = 'student';
        }

        if (!user) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        // Check admin status for teachers
        if (role === 'teacher') {
            isAdmin = user.m01_is_admin;
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.m01_id || user.m03_id, role, isAdmin },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Prepare response data
        const responseData = {
            id: user.m01_id || user.m03_id,
            name: user.m01_name || user.m03_name,
            email: user.m01_email || user.m03_email,
            contact_number: (user.m01_contact_number || user.m03_contact_number).toString(),
            isAdmin,
            role
        };

        return res.status(200).json({
            status: "Success",
            message: "OTP verified, login successful",
            data: responseData,
            token
        });

    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).json({
            error: error.message || 'An error occurred while verifying OTP'
        });
    }
};

