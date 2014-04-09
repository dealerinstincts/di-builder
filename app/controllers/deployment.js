/**
 * mobile.js
 * Provides build functionalities for mobile.
 * 
 * @author  Jason Valdron <jason@dealerinstincts.com>
 * @package di-api
 */

(function() {
  'use strict';

  var async = require('async'),
      aws = require('aws-sdk'),
      moment = require('moment'),
      schedule = require('node-schedule');

  // Export the route function.
  module.exports = function(app){

    var hadErrors = false;

    // Checks if any other deployment failed, if so, we'll have to wait until all
    // deployments are done to deploy back the old version.
    var checkIfErrors = function(stacks, cb){

      if (hadErrors) {

        // Check if we're still deploying.
        var deploying = false;
        app.config.targets.stacks.forEach(function(stack){
          if (stack.deploying) deploying = true;
        });

        // We're still deploying, let's wait until another stack is done.
        if (deploying) return cb();

        hadErrors = false;

        // We're no longer deploying, let's revert!
        methods.deploy(stacks, null, cb, true);

      } else {
        return cb();
      }

    };

    var methods = {
      deploy: function(stacks, branch, cb, revert){

        var opsworks = new aws.OpsWorks();

        // Build all the targets that requires us to be built.
        async.each(app.config.targets.stacks, function(stack, cb){

          // Try to revert to the previous branch if specified.
          if (revert) branch = stack.previousBranch || branch;

          if (stacks && stacks.length && stacks.indexOf(stack.name) === -1) return cb();

          var key = 'deployment-' + stack.name + '-' + branch + '-' + Date.now();

          // Start this action.
          app.actions[key] = {
            action: (revert ? 'Reverting to ' : 'Deploying ') + branch + ' branch on ' + stack.name + ' stack',
            status: 'inProcess'
          };

          app.actions[key].description = 'Getting list of apps on the stack';

          // Update the deploying flag.
          app.config.targets.stacks.forEach(function(entry){
            if (entry.name === stack.name) entry.deploying = true;
          });

          // Get the apps for all the this stack.
          opsworks.describeApps({
            StackId: stack.id
          }, function(err, apps){

            app.actions[key].description = 'Configuring the app to use the ' + branch + ' branch';

            // Update the branch on our stack on OpsWork.
            opsworks.updateApp({
              AppId: apps.Apps[0].AppId,
              AppSource: {
                Revision: branch
              }
            }, function(err, data){

              if (err) {
                app.actions[key].status = 'error';
                app.actions[key].description = 'Failed to update branch on app';
                return cb('failed-update-branch');
              }

              app.actions[key].description = 'Sending deployment command to OpsWorks';

              // Send the deployment command.
              opsworks.createDeployment({
                StackId: stack.id,
                AppId: apps.Apps[0].AppId,
                Command: {
                  Name: 'deploy'
                }
              }, function(err, deployment){

                if (err) {
                  app.actions[key].status = 'error';
                  app.actions[key].description = 'Failed to send deployment command';
                  return cb('failed-deploy-branch');
                }

                app.actions[key].description = 'Waiting for reply from OpsWorks';

                var watch = setInterval(function(){

                  // Check if we have an update in our deployment status.
                  opsworks.describeDeployments({
                    DeploymentIds: [ deployment.DeploymentId]
                  }, function(err, deployments){

                    if (!(deployments && deployments.Deployments && deployments.Deployments.length)) return;

                    var deployment = deployments.Deployments[0];

                    if (deployment.Status !== 'running') {

                      clearInterval(watch);
                    
                      // Update the existing branch value on the stack.
                      app.config.targets.stacks.forEach(function(entry){
                        if (entry.name === stack.name) {
                          entry.previousBranch = entry.branch;
                          entry.branch = branch;
                          entry.deploying = false;
                        }
                      });

                      if (deployment.Status === 'failed') {

                        hadErrors = true;
                        app.actions[key].status = 'error';
                        app.actions[key].description = 'Failed to ' + (revert ? 'revert' : 'deploy') + ', see deployment log for more details';

                        if (revert) return cb('failed-revert');

                        checkIfErrors(stacks, function(){
                          return cb('failed-deployment');
                        });

                      } else {

                        app.actions[key].status = 'completed';
                        app.actions[key].completedAt = moment();
                        app.actions[key].description = null;

                        // All done deploying this target.
                        checkIfErrors(stacks, cb);

                      }

                    }

                  });

                }, 5000);

              });

            });

          });

        }, cb);

      }
    };

    // POST /deploy - Deploy a new version of the app on staging.
    app.post('/deploy', function(req, res){

      res.redirect('/');

      var deploy = function(options){
        if (options.stacks && options.stacks.length) {
          methods.deploy(options.stacks, options.branch);
        }

        if (options['build-mobile']) {
          var mobile = require(process.cwd() + '/app/controllers/mobile')(app);
          mobile.build(false, options.branch);
        }
      };

      if (req.body.time === 'now') {
        return deploy(req.body);
      } else {
        var at = moment().add('days', 1).hours(req.body.time).minutes(0).seconds(0);
        req.body.job = schedule.scheduleJob(at.toDate(), function(){
          req.body.job.cancel();
          return deploy(req.body);
        });
        req.body.dateTime = at.format('MMMM Do, YYYY hh:mm A');
        req.body.id = Object.keys(app.scheduledDeployments).length;
        app.scheduledDeployments[Object.keys(app.scheduledDeployments).length] = req.body;
      }

    });

    // POST /deployment/:id/delete - Deletes a scheduled deployment.
    app.post('/deployment/:id/delete', function(req, res){
      
      if (!app.scheduledDeployments[req.params.id]) return res.json(404, 'deployment-not-found');
      app.scheduledDeployments[req.params.id].job.cancel();
      delete app.scheduledDeployments[req.params.id];

      return res.json(200, 'ok');

    });

    return methods;

  };

})();