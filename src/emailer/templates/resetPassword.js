module.exports = function template({ token }) {
    const resetURL = `${process.env.CLIENT_URL}/api/auth/reset-password?token=${token}`;

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .footer { margin-top: 30px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Reset Your Password</h2>
                <p>A password reset has been requested by your account. To reset your password, click the link below:</p>

                <a href="${resetURL}">Reset Password</a>

                <p>This link expires in 24 hours.</p>

                <div class="footer">
                    <p>If you didn't request a password reset, please ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
    `
}