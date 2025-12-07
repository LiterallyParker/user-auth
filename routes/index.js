const path = require('path');
const fs = require('fs');

const { Router } = require("express");
const apiRoutes = Router();

// Dynamically load all route files
fs.readdirSync(__dirname)
    .filter(file => file !== 'index.js' && file.endsWith('.js'))
    .forEach(file => {
        const routeName = path.basename(file, '.js');
        const route = require(path.join(__dirname, file));
        apiRoutes.use(`/${routeName}`, route);
    });

module.exports = apiRoutes