const transporter = require("./transporter");

const templates = {
    VerifyEmail: {
        subject: "Verify Your Email Address",
        template: require("./templates/verifyEmail")
    },
    ResetPassword: {
        subject: "Reset Your Password",
        template: require("./templates/resetPassword")
    }
};

async function sendEmail({ to, type, data }) {
    try {
        const emailType = templates[type];
        if (!emailType) {
            throw new Error(`Unknown email type: ${type}`);
        };

        const html = emailType.template(data);

        const mailOptions = {
            from: `<${process.env.SMTP_USER}>`,
            to,
            subject: emailType.subject,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`Error sending ${type} email:`, error);
        return { success: false, error: error.message };
    };
};

module.exports = sendEmail