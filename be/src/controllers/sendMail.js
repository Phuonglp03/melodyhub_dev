import nodemailer from 'nodemailer';
import 'dotenv/config';

const sendMail = async({email, subject, html}) => {
    try {
        if (process.env.NODE_ENV === 'test') {
            console.log('Email:', email);
            console.log('Subject:', subject);
            console.log('HTML:', html);
            console.log('Email sent successfully (test mode)');
            return { success: true };
        }

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('Email credentials not configured');
            return { success: false, error: 'Email service not configured' };
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const message = {
            from: 'MelodyHub <' + process.env.EMAIL_USER + '>',
            to: email,
            subject: subject,
            html: html
        };

        const info = await transporter.sendMail(message);
        console.log('Email sent:', info.messageId);
        return { success: true, info };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
};
export default sendMail;