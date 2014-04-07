/**
 * server.js
 * Main file for the build server. Starts out an Express instance and then 
 * waits until we request a new build.
 * 
 * @author  Jason Valdron <jason@dealerinstincts.com>
 * @package di-api
 */

(function(){
    'use strict';
    
    // Include the bootstrap and start listening the application.
    require(process.cwd() + '/app/bootstrap')(function(app, server){

        app.logger.info('Build server started on port ' + server.address().port + '!');

    });

})();
