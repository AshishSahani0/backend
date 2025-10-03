
import nodemailer from "nodemailer";


const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, 
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_PORT === '465', 
    auth: {
        user: process.env.SMTP_MAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

// Verification check (Optional, good practice)
transporter.verify(function (error, success) {
    if (error) {
        console.error("❌ SMTP Connection Error (Please check MailerSend credentials):", error);
    } else {
        console.log("✅ SMTP server (MailerSend) is ready to take messages.");
    }
});


// Export the new NON-BLOCKING email sender
export const sendEmail = ({ to, subject, html }) => {
    const mailOptions = {
        from: `SAARTHI <${process.env.SMTP_MAIL}>`,
        to,
        subject,
        html,
    };

    // 💡 FIRE-AND-FORGET: Send the email asynchronously without blocking the API response.
    // Errors are logged internally and do NOT throw to the controller.
    transporter.sendMail(mailOptions)
        .then(() => {
            console.log(`✅ Email queued successfully to ${to} (Non-blocking via MailerSend)`);
        })
        .catch(error => {
            // Log the error message, but do NOT re-throw or the main thread will block.
            console.error(`❌ Non-blocking email FAILED for ${to}:`, error.message);
        });

    // The function returns immediately.
};

export default sendEmail;