module.exports = function template({ token }) {
    const resetURL = `${process.env.CLIENT_URL}/api/auth/reset-password?token=${encodeURIComponent(token)}`;

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
                <h2>Lost your chips? No worries.</h2>
                <p>Someone (hopefully you) asked to reset the password for your Parker's Poker account. Click the link below to deal yourself a fresh one:</p>

                <a href="${resetURL}">Reset Password</a>

                <p>This link expires in 1 hour.</p>

                <div class="footer">
                    <p>If you didn't request this, just ignore this email. Your seat at the table is safe.</p>
                </div>
            </div>
        </body>
        </html>
    `
}