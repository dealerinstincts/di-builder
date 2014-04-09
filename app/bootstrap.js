/**
 * bootstrap.js
 * Loads the configurations, setup Express, setup all static assets 
 * and our routes.
 * 
 * @author  Jason Valdron <jason@dealerinstincts.com>
 * @package di-builder
 */

(function(){
    'use strict';

    // Load up the depencencies.
    var aws = require('aws-sdk'),
        express = require('express'),
        fs = require('fs'),
        github = require('github'),
        less = require('less-middleware'),
        walker = require('walk'),
        winston = require('winston'),
        zlib = require('zlib');
        require('winston-email');

    // Export the main app function.
    module.exports = function(cb){

        var app = express(),
            server = require('http').createServer(app);
        
        // Setup the logger.
        var transports = [
            new winston.transports.Console({
                colorize: true,
                timestamp: true,
                level: 'debug'
            })
        ];
        var exceptionHandlers = [
            new winston.transports.Console({ colorize: true, timestamp: true }),
            new winston.transports.File({ filename: process.cwd() + '/log/exceptions.log', maxsize: 2 * 1024 * 1024 })
        ];

        var email = require(process.cwd() + '/config/email')();
    
        // Make sure we have a temporary directory.
        if (!fs.existsSync(process.cwd() + '/log'))  fs.mkdirSync(process.cwd() + '/log', 511); // 0777 in decimal
    
        // We add a debug.log file transport for when we're in development mode.
        transports.push(new winston.transports.File({ filename: process.cwd() + '/log/debug.log', maxsize: 2 * 1024 * 1024 }));

        // Create a new logger.
        app.logger = new winston.Logger({
            transports: transports,
            exceptionHandlers: exceptionHandlers
        });
        
        app.logger.info('Logger initialized!');

        // Make sure we have a temporary directory.
        if (!fs.existsSync(process.cwd() + '/tmp')) {
            
            app.logger.info('Creating temporary directory');
            fs.mkdirSync(process.cwd() + '/tmp', 511); // 0777 in decimal
            
        }
            
        // Make sure we have a builds directory.
        if (!fs.existsSync(process.cwd() + '/builds')) {
            
            app.logger.info('Creating builds directory');
            fs.mkdirSync(process.cwd() + '/builds', 511); // 0777 in decimal
            
        }
            
        app.logger.info('Loading config files...');

        app.config = {};

        var walk = walker.walk(process.cwd() + '/config');
        
        // Loop through all the configs.
        walk.on('file', function(root, file, next){

            if (~file.name.indexOf('.js')) {

                // Remove the extension.
                var name = file.name.substr(0, file.name.indexOf('.'));
                
                // Load the config.
                app.config[name] = require(root + '/' + file.name)(app);

                app.logger.info('- Config %s loaded', file.name);

            }

            next();

        });
        
        // Done loading the configs.
        walk.on('end', function(){

            // Disable socket pooling.
            require('http').globalAgent.maxSockets = Math.min();

            // Setup basic auth.
            app.use(require('basic-auth-connect')(app.config.auth.username, app.config.auth.password));

            app.logger.info('Setting up Jade...');

            // Setup Jade.
            app.set('views', process.cwd() + '/app/views');
            app.set('view engine', 'jade');
            app.engine('.html', function(path, options, cb){
                fs.readFile(path, 'utf-8', cb);
            });

            // Trust out the X-Forwarded-* header fields.
            app.enable('trust proxy');
            app.disable('x-powered-by');

            app.logger.info('Setting up LESS middleware...');

            // Use the LESS middleware.
            app.use(less({
                src: process.cwd() + '/app/assets/css',
                dest: process.cwd() + '/public/css',
                prefix: '/css',
                compress: false
            }));

            app.logger.info('Setting up JavaScript middleware...');

            // Send out plain JavaScript.
            app.use(function(req, res, next){

                // Check if we have a JavaScript file.
                if (req.url.match(/\/js\/(.*).js/g)) {

                    // Read the original.
                    fs.readFile(process.cwd() + '/app/assets/' + (req.url.indexOf('?') > -1 ? req.url.substr(0, req.url.indexOf('?')) : req.url), {
                        encoding: 'utf8'
                    }, function(err, script){

                        if (err) return next(err);

                        // Send out the original file.
                        res.header('Content-Encoding', 'gzip');
                        res.header('Content-Type', 'text/javascript');

                        // Include our imports.
                        script = script.replace(/\/\/ \@import '(.*)';/g, function(match, url){
                            return fs.readFileSync(process.cwd() + '/app/assets/js/' + url);
                        });

                        // Compress our script with GZIP.
                        zlib.gzip(script, function(err, compressed){
                            return res.end(compressed);
                        });

                    });

                } else {
                    return next();
                }

            });

            // Disable caching (fix for IE8).
            app.disable('etag');

            app.use(require('body-parser')());

            // Setup gzip compression.
            app.use(require('compression')());

            app.logger.info('Serving up static files...');

            // Serve out static files.
            app.use(require('serve-static')(process.cwd() + '/public'));

            app.logger.info('Configuring AWS...');

            // Configure AWS.
            aws.config.update(app.config.aws);

            app.logger.info('Configuring GitHub...');

            // Connect to GitHub.
            app.github = new github({
                version: '3.0.0'
            });
            app.github.authenticate(app.config.github);

            app.logger.info('Adding a ping endpoint...');

            // GET /ping - Responds with 200 PONG.
            app.get('/ping', function(req, res){

                return res.json(200, 'PONG');

            });

            app.logger.info('Loading controllers...');

            walk = walker.walk(process.cwd() + '/app/controllers');

            // Loop through all the controllers.
            walk.on('file', function(root, file, next){
                
                // Load the router.
                var route = require(root + '/' + file.name)(app);

                app.logger.info('- Controller %s loaded!', file.name);

                next();

            });

            app.actions = {};
            app.scheduledDeployments = {};

            // Done loading the controllers.
            walk.on('end', function(){

                // Listen for incoming HTTP requests.
                server.listen(process.env.PORT || 8116);

                // Trigger the callback and pass the app.
                return cb(app, server);

            });

        });

    };

})();