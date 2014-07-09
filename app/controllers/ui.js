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
      aws = require('aws-sdk'),
      fs = require('fs'),
      Github = require('github'),
      moment = require('moment');

  // Export the route function.
  module.exports = function(app){

    var getData = function(cb){

      var opsworks = new aws.OpsWorks();

      app.logger.silly('Looping through the stacks');

      // Loop through all the targets.
      async.map(app.config.targets.stacks, function(stack, cb){

      app.logger.silly('Describing deployments ' + stack.name);

        // Get the deployments for all the this stack.
        opsworks.describeDeployments({
          StackId: stack.id
        }, function(err, deployments){

          // Return any errors we get.
          if (err) {
            app.logger.error('Error grabbing deployments', err);
            return cb(err);
          }

          // Add the data to the stack.
          stack.deployments = deployments.Deployments;
            
          if (stack.branch) {
            return cb(null, stack);
          } else {

            app.logger.silly('Describing apps ' + stack.name);

            // Get the apps for all the this stack.
            opsworks.describeApps({
              StackId: stack.id
            }, function(err, apps){

              // Return any errors we get.
              if (err) {
                app.logger.error('Error grabbing apps', err);
                return cb(err);
              }

              // Add the data to the stack.
              stack.branch = apps.Apps[0].AppSource.Revision || 'master';

              return cb(null, stack);

            });

          }

        });

      }, function(err, stacks){

        app.logger.silly('Getting builds');

        // Get the list of builds.
        fs.readdir(process.cwd() +  '/builds', function(err, builds){

          if (err) {
            app.logger.error('Error grabbing builds', err);
            return cb(err);
          }

          return cb(null, {
            stacks: stacks,
            deployments: Object.keys(app.scheduledDeployments).map(function(key){
              return app.scheduledDeployments[key];
            }),
            builds: builds.map(function(build){

                var values = /(.*?)-(.*(?=-))-([0-9].*)\.([0-9].*)\./g.exec(build),
                    version = /(v.*)/g.exec(values[2]);

                    console.log(values[3]);

                return {
                  type: values[1],
                  filename: build,
                  name: version && version[1] ? values[2].replace('-' + version[1], '') : values[2].substr(0, values[2].lastIndexOf('-')),
                  branch: version && version[1] ? version[1] : values[2].substr(values[2].lastIndexOf('-') + 1),
                  time: values[3],
                  versionCode: values[4],
                  dateTime: moment.unix(values[3] / 1000).local().format('MMMM Do, YYYY hh:mm A')
                };

              }).filter(function(build){
                return build.type === 'mobile';
              }).sort(function(a, b){
                return b.time - a.time;
              }).splice(0, 10)
          });

        });

      });

    };

    // GET / - Main screen for deployment UI.
    app.get('/', function(req, res){

      var params = app.config.targets.tagsFrom;
      params.page = 0;
      params.per_page = 5;

      // Connect to GitHub.
      var github = new Github({
          version: '3.0.0'
      });
      github.authenticate(app.config.github);

      // Get the list of tags for our repo.
      github.repos.getTags(params, function(err, tags){

        // Render our main UI.
        return res.render('ui', {
          stacks: app.config.targets.stacks,
          tags: tags
        });

      });

    });

    // GET /data - Provides a way to refresh data.
    app.get('/data', function(req, res){

      getData(function(err, data){
        return res.json(err ? 500 : 200, err || data);
      });

    });

    // GET /actions - Get all the current actions.
    app.get('/actions', function(req, res){
      
      // Clear expired actions.
      Object.keys(app.actions).forEach(function(key){
        if (moment().diff(app.actions[key].completedAt, 'minutes') >= 1) delete app.actions[key];
      });

      return res.json(200, Object.keys(app.actions).map(function(key){
        return app.actions[key];
      }));

    });

    // POST /actions/clear - Clear completed actions.
    app.post('/actions/clear', function(req, res){
      
      // Clear actions that are completed or has errors.
      Object.keys(app.actions).forEach(function(key){
        if (app.actions[key].status !== 'inProcess') delete app.actions[key];
      });

    });

    // GET /deployment/:id/log - Get the logs for the deployment.
    app.get('/deployment/:id/log', function(req, res){

      var opsworks = new aws.OpsWorks();

      // Get the command for this deployment.
      opsworks.describeCommands({
        DeploymentId: req.params.id
      }, function(err, commands){

        // Return any errors we get.
        if (err) return res.json(500, err);

        if (commands && commands.Commands && commands.Commands.length) {
          return commands.Commands[0].LogUrl ? res.redirect(commands.Commands[0].LogUrl) : res.json(404, 'no-log-available');
        } else {
          return res.json(400, 'not-found');
        }

      });

    });

  };

})();