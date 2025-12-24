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
                .footer { margin-top: 30px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Verify Your Email</h2>
                <p>Hi ${username || 'there'}!</p>
                <p>Thanks for signing up. Please verify your email address by clicking the button below:</p>

                <a href="${verifyURL}">Verify Email</a>

                <p>This link expires in 24 hours.</p>

                <div class="footer">
                    <p>If you didn't create an account, please ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
    `
}