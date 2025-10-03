// src/util/sendEmail.js

import nodemailer from "nodemailer";

// --- Configuration Values ---
// NOTE: This must be the email address you VERIFIED as a sender in Brevo.
const SENDER_EMAIL_ADDRESS = "ashishsahani6392@gmail.com"; 

// Initialize Transporter ONCE
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, 
    port: parseInt(process.env.SMTP_PORT, 10),
    // Correctly determines secure: false for Port 587
    secure: process.env.SMTP_PORT === '465', 
    auth: {
        // Nodemailer uses SMTP_MAIL for the authentication username (Brevo Login)
        user: process.env.SMTP_MAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

// Verification check (Optional, good practice)
transporter.verify(function (error, success) {
    if (error) {
        // Renamed error message reference
        console.error("❌ SMTP Connection Error (Please check Brevo credentials):", error);
    } else {
        // Renamed success message reference
        console.log("✅ SMTP server (Brevo) is ready to take messages.");
    }
});


// Export the new NON-BLOCKING email sender
export const sendEmail = ({ to, subject, html }) => {
    const mailOptions = {
        // FIX: The FROM field now uses the human-readable, verified email address
        from: `SAARTHI <${SENDER_EMAIL_ADDRESS}>`, 
        to,
        subject,
        html,
    };

    // 💡 FIRE-AND-FORGET: Send the email asynchronously without blocking the API response.
    // Errors are logged internally and do NOT throw to the controller.
    transporter.sendMail(mailOptions)
        .then(() => {
            // Renamed success message reference
            console.log(`✅ Email sent successfully to ${to} (Non-blocking via Brevo)`);
        })
        .catch(error => {
            // Renamed error message reference
            console.error(`❌ Non-blocking email FAILED for ${to}:`, error.message);
        });

    // The function returns immediately.
};

export default sendEmail;