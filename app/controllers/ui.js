/**
 * ui.js
 * Provides a way to select which tag to deploy.
 * 
 * @author  Jason Valdron <jason@dealerinstincts.com>
 * @package di-api
 */

(function() {
  'use strict';

  var async = require('async'),
      Aws = require('aws-sdk');

  // Export the route function.
  module.exports = function(app){

    // GET / - Main screen for deployment UI.
    app.get('/', function(req, res){

      var opsworks = new Aws.OpsWorks();

      // Loop through all the targets.
      async.map(app.config.targets.stacks, function(stack, cb){

        // Get the deployments for all the this stack.
        opsworks.describeDeployments({
          StackId: stack.id
        }, function(err, deployments){

          // Return any errors we get.
          if (err) return cb(err);

          // Add the data to the stack.
          stack.deployments = deployments.Deployments;

          return cb(null, stack);

        });

      }, function(err, stacks){

        var params = app.config.targets.tagsFrom;
        params.page = 0;
        params.per_page = 5;

        // Get the list of tags for our repo.
        app.github.repos.getTags(params, function(err, tags){

          // Render our main UI.
          return res.render('ui', {
            stacks: stacks,
            tags: tags
          });

        });

      });

    });

    // GET /actions - Get all the current actions.
    app.get('/actions', function(req, res){
      return res.json(200, Object.keys(app.actions).map(function(key){
        return app.actions[key];
      }));
    });

                      /*
        {
          action: 'Building mobile build di-frontend-staging from master',
          status: 'completed',
          description: 'Downloading sources from https://github.com/dealerinstincts/di-frontend.git'
        },
        {
          action: 'Building mobile build di-frontend-staging from master',
          status: 'inProgress',
          description: 'Downloading sources from https://github.com/dealerinstincts/di-frontend.git'
        },
        {
          action: 'Building mobile build di-frontend-staging from master',
          status: 'error',
          description: 'Downloading sources from https://github.com/dealerinstincts/di-frontend.git'
        }
        */
      

  };

})();