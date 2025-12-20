module.exports = function template({ token, username }) {
    const verifyURL = `${process.env.CLIENT_URL}/api/auth/verify-email?token=${token}`;

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .button {
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #007bff;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                .footer { margin-top: 30px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Verify Your Email</h2>
                <p>Hi ${username || 'there'}!</p>
                <p>A password reset has been requested by your account. To reset your password, click the link below:</p>

                <a href="${verifyURL}">Verify Email</a>

                <p>This link expires in 24 hours.</p>

                <div class="footer">
                    <p>If you didn't request this reset, please ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
    `
}