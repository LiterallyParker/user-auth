IMPORTANT
---------
This server requires postgresql and node. Install with:

`sudo apt install postgresql npm`

Also, in order to acheive email functionality, you will need to get an app password from a valid gmail account, which will be the environment variables SMTP_USER and SMTP_PASS.

**Keep in mind this will be the email that users will recieve emails from**.

Running This Server
----------------------
- Clone the repo
- Add environment variables
- run these commands:

    `npm install`
    `npm run build`
    `npm run start`

- Server is up and running!

Dependencies
---------------
*Required:*
- bcrypt: ^6.0.0
- cookie-parser: ^1.4.7
- cors: ^2.8.5
- dotenv: ^17.2.3
- pg: ^8.16.3
- express: ^5.2.1
- express-validator: ^7.3.1
- jsonwebtoken: ^9.0.2
- morgan: ^1.10.1
- nodemailer: ^7.0.11

*To be implemented:*
- uuid: ^13.0.0
- express-rate-limit: ^8.2.1
- socket.io: ^4.8.1
- helmet: ^8.1.0

