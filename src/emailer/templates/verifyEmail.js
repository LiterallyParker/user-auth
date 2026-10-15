module.exports = function template({ token, username }) {
    const verifyURL = `${process.env.CLIENT_URL}/?verifyEmail=${encodeURIComponent(token)}`;

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
                <h2>Welcome to Parker's Poker</h2>
                <p>Hi ${username || 'there'}!</p>
                <p>Thanks for pulling up a chair. Please confirm your email by clicking the link below and we'll save your seat:</p>

                <a href="${verifyURL}">Verify Email</a>

                <p>This link expires in 1 hour.</p>

                <div class="footer">
                    <p>If you didn't sign up for Parker's Poker, you can safely ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
    `
}