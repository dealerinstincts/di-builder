/**
 * deployment.js
 * Provides deployment functionalities.
 * 
 * @author  Jason Valdron <jason@dealerinstincts.com>
 * @package di-api
 */

(function() {
  'use strict';

  var async = require('async'),
      aws = require('aws-sdk'),
      bower = require('bower'),
      fs = require('fs-extra'),
      Github = require('github'),
      npm = require('npm'),
      moment = require('moment'),
      schedule = require('node-schedule'),
      request = require('request'),
      progress = require('request-progress'),
      Targz = require('tar.gz');

  // Export the route function.
  module.exports = function(app){

    // Downloads a tarball from a repo and extracts it.
    var downloadAndExtractTarball = function(key, stack, repo, branch, cb){

      var tmp = process.cwd() + '/tmp/' + key + '/';

      app.actions[key].description = 'Grabbing ' + repo + ' ' + branch + '\'s tarball';

      // Connect to GitHub.
      var github = new Github({
          version: '3.0.0'
      });
      github.authenticate(app.config.github);

      // Get the link to the tarball
      github.repos.getArchiveLink({
        user: stack.user,
        repo: repo,
        archive_format: 'tarball',
        ref: ~[ 'master', 'dev' ].indexOf(branch) ? branch : 'refs/tags/' + branch
      }, function(err, archive){

        // Create a request to grab the tarball.
        progress(request(archive.meta.location)).on('progress', function(state){

          app.actions[key].description = 'Grabbing ' + repo + ' ' + branch + '\'s tarball' + (state.percent ? ' (' + state.percent + '%)' : '');

        }).on('error', function(err){

          app.actions[key].status = 'error';
          app.actions[key].description = 'Failed to download /' + stack.repo + '/tarball/' + branch + ' tarball';
          return cb('error-download-tarball');

        }).pipe(fs.createWriteStream(tmp + 'tmp.tar.gz')).on('close', function(){

          app.actions[key].description = 'Deflating ' + repo + ' ' + branch + '\'s tarball';

          // Extract the tarball.
          new Targz().extract(tmp + 'tmp.tar.gz', tmp, function(err){

            if (err) {
              app.actions[key].status = 'error';
              app.actions[key].description = 'Failed to deflate ' + repo + ' tarball';
              return cb('error-download-tarball');
            }

            // We don't need the tarball anymore.
            fs.unlink(tmp + 'tmp.tar.gz', function(){

              // All done downloading and extracting this tarball.
              return cb(archive);

            });

          });

        });

      });

    };

    var methods = {
      deploy: function(environments, branch, cb){

        // Build all the targets that requires us to be built.
        async.each(app.config.targets.stacks, function(stack, cb){

          if (environments && environments.length && environments.indexOf(stack.env) === -1) return cb();

          var key = 'deployment-' + stack.name + '-' + branch + '-' + Date.now();

          // Start this action.
          app.actions[key] = {
            action: 'Deploying ' + branch + ' branch on ' + stack.name + ' stack',
            status: 'inProcess'
          };

          var tmp = process.cwd() + '/tmp/' + key + '/';

          // Create temporary folder for storing things for this operation.
          fs.mkdir(tmp, function(){

            // Download the branch tarball.
            downloadAndExtractTarball(key, stack, stack.repo, branch, function(){

              // Attempt to find the folder we need.
              fs.readdir(tmp, function(err, files){

                files.forEach(function(file){
                  if (~file.indexOf('di-')) fs.renameSync(tmp + file, tmp + 'src');
                });

                async.series([

                  function(done){

                    app.actions[key].description = 'Running npm install for ' + branch + ' branch on ' + stack.name + ' stack';

                    // Run npm install.
                    npm.load(JSON.parse(fs.readFileSync(tmp + 'src/package.json', {
                      encoding: 'utf8'
                    })), function(){

                      npm.prefix = tmp + 'src/';

                      npm.commands.install(function(err, data){

                        if (err) return done(err); 
                        return done();

                      });

                    });

                  },

                  function(done){

                    if (~stack.name.indexOf('frontend')) {

                      app.actions[key].description = 'Running bower install for ' + branch + ' branch on ' + stack.name + ' stack';

                      // Run bower install.
                      bower.config.cwd = tmp + 'src/';
                      bower.commands.install().on('error', done).on('end', function(){
                        return done();
                      });

                    } else {
                      return done();
                    }

                  }

                ], function(err){

                  if (err) {
                    app.actions[key].status = 'error';
                    app.actions[key].description = 'Failed to run npm/bower.';
                    console.log(err);
                    return cb('error-npm-bower');
                  }

                  app.actions[key].description = 'Compiling assets for ' + branch + ' branch on ' + stack.name + ' stack';

                  // Run the grunt deployment.
                  var grunt  = require('child_process').exec('/usr/bin/grunt deploy --target=' + stack.env + ' --tag=' + branch + ' --allow-root', {
                    cwd: tmp + 'src/'
                  }, function(err, stdout, stderr){

                    if (err) {
                      app.actions[key].status = 'error';
                      app.actions[key].description = 'Failed to run grunt: ' + stdout;
                      return cb('error-grunt');
                    }

                    // Completely delete the temp folder we used.
                    fs.remove(tmp, function(){

                      app.actions[key].status = 'completed';
                      app.actions[key].completedAt = moment();
                      app.actions[key].description = null;

                      // All done deploying this part.
                      return cb();

                    });

                  });

                });

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
        if (options.environments && options.environments.length) {
          methods.deploy(options.environments, options.branch);
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