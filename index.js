// Load env
require("dotenv").config({ quiet: true });

// Server stuff
const express = require("express");
const { Server } = require("socket.io");
const { createServer } = require("http");
const path = require("path");
const cookieParser = require("cookie-parser");

// Sercurity and logging
const cors = require("cors");
const morgan = require("morgan");

// Basic server setup
const server = express();
const httpServer = createServer(server);
const io = new Server(httpServer);
const PORT = process.env.PORT;
const routes = require("./routes");
const { ANSIcolors } = require("./util");

server.use(cors());
server.use(morgan('tiny'));
server.use(express.json());
server.use(cookieParser());

server.use(express.static(path.join(__dirname, "public"), {
	max_age: "1h",
	etag: true
}));

server.use("/api", routes)

server.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => console.log(`Server is listening\nClient: ${ANSIcolors.yellow}${process.env.CLIENT_URL}${ANSIcolors.reset}`));