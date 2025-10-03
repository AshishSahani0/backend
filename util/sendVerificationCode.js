
import { generateVerificationOtpEmailTemplate } from "./emailTemplate.js";
import sendEmail from "./sendEmail.js";


export function sendVerificationCode(verificationCode, email) { 
    const html = generateVerificationOtpEmailTemplate(verificationCode);
    sendEmail({ 
      to: email,
      subject: "Your SAARTHI Verification Code",
      html,
    });
}
