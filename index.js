// Load env
require("dotenv").config({ quiet: true });

// Server stuff
const express = require("express");
const { Server } = require("socket.io");
const { createServer } = require("http");
const path = require("path");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const helmet = require("helmet");

// Sercurity and logging
const cors = require("cors");
const morgan = require("morgan");

// Basic server setup
const server = express();
const httpServer = createServer(server);
const io = new Server(httpServer, {
	maxHttpBufferSize: 1e4,
	serveClient: true
});
const routes = require("./src/routes");
const startCronJobs = require("./src/cron")
const { initRealtime } = require("./src/realtime");
const { ANSIcolors } = require("./src/util");
const PORT = process.env.PORT;

server.use(helmet({
	contentSecurityPolicy: {
		directives: {
			...helmet.contentSecurityPolicy.getDefaultDirectives(),
			// Profile avatars can be any https image, or a local preview
			"img-src": ["'self'", "data:", "blob:", "https:"],
			"upgrade-insecure-requests": null
		}
	}
}));
server.use(compression());
server.use(cors());
// server.use(morgan('tiny'));
server.use(express.json());
server.use(cookieParser());


server.use(express.static(path.join(__dirname, "public"), {
	etag: true,
	// Assets aren't fingerprinted, so always revalidate (cheap 304s) to avoid stale JS/CSS after updates
	setHeaders: res => res.setHeader("Cache-Control", "no-cache")
}));

server.use("/api", routes)

// Client-side routes all serve the single-page app shell
const APP_ROUTES = ["/sign_in", "/register", "/my_account", "/players", "/profile", "/messages", "/clubs"];
const sendIndex = (req, res) => {
	res.sendFile(path.join(__dirname, "public", "index.html"));
};
server.get(["/", ...APP_ROUTES, ...APP_ROUTES.map(route => `${route}/*splat`)], sendIndex);

initRealtime(io);
startCronJobs()
httpServer.listen(PORT, () => console.log(`Server is listening on port ${PORT}
  Client: ${ANSIcolors.yellow}${process.env.CLIENT_URL}${ANSIcolors.reset}`
));