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
      fs = require('fs-extra'),
      Github = require('github'),
      moment = require('moment'),
      request = require('request'),
      progress = require('request-progress'),
      targz = require('tar.gz');

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
        ref: branch === 'master' ? branch : 'refs/tags/' + branch
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
          new targz().extract(tmp + 'tmp.tar.gz', tmp, function(err){

            if (err) {
              app.actions[key].status = 'error';
              app.actions[key].description = 'Failed to deflate ' + repo + ' tarball';
              return cb('error-download-tarball');
            }

            // We don't need the tarball anymore.
            fs.unlink(tmp + 'tmp.tar.gz', function(){

              // All done downloading and extracting this tarball.
              return cb();

            });

          });

        });

      });

    };

    var methods = {
      build: function(stacks, branch, cb){

        // Build all the targets that requires us to be built.
        async.each(app.config.targets.stacks, function(stack, cb){

          if (stacks && stacks.length && stacks.indexOf(stack.name) === -1) return cb();

          // Skip it if we don't have to build mobile.
          if (!stack.mobile) return cb();

          var key = 'mobile-' + stack.name + '-' + branch + '-' + Date.now();

          // Start this action.
          app.actions[key] = {
            action: 'Building mobile build ' + stack.name + ' from ' + branch,
            status: 'inProcess'
          };

          app.actions[key].description = 'Creating temporary folder';

          var tmp = process.cwd() + '/tmp/' + key + '/';

          // Create temporary folder for storing things for this operation.
          fs.mkdir(tmp, function(){

            // Download the mobile and the branch tarball.
            downloadAndExtractTarball(key, stack, stack.mobile.repo, 'master', function(){
              downloadAndExtractTarball(key, stack, stack.repo, branch, function(){

                // Call the build script for this target.
                stack.mobile.build(key, {
                  repo: stack.user,
                  name: stack.mobile.repo,
                  branch: branch
                }, function(err){

                  if (!err) app.actions[key].description = 'Removing temporary directory';

                  // Completely delete the temp folder we used.
                  fs.remove(tmp, function(){

                    if (err) return cb(err);

                    app.actions[key].status = 'completed';
                    app.actions[key].completedAt = moment();
                    app.actions[key].description = null;

                    // All done building this target.
                    return cb();

                  });

                });

              });
            });

          });

        }, cb);

      }
    };

    // GET /mobile/build/:filename - Downloads a mobile build.
    app.get('/mobile/build/:filename', function(req, res){
      return res.download(process.cwd() + '/builds/' + req.params.filename.replace('..', ''));
    });

    // POST /mobile/build - Create all mobile builds from master branch.
    app.post('/mobile/build', function(req, res){

      res.redirect('/');
      return methods.build(false, 'master');

    });

    return methods;

  };

})();