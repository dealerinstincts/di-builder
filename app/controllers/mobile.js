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
      request = require('request'),
      progress = require('request-progress'),
      targz = require('tar.gz');

  // Export the route function.
  module.exports = function(app){

    // Downloads a tarball from a repo and extracts it.
    var downloadAndExtractTarball = function(key, stack, repo, branch, cb){

      var tmp = process.cwd() + '/tmp/' + key + '/';

      app.actions[key].description = 'Grabbing ' + repo + ' master\'s tarball';

      // Get the link to the tarball
      app.github.repos.getArchiveLink({
        user: stack.user,
        repo: repo,
        archive_format: 'tarball',
        ref: branch
      }, function(err, archive){

        // Create a request to grab the tarball.
        progress(request(archive.meta.location)).on('progress', function(state){

          app.actions[key].description = 'Grabbing ' + repo + ' master\'s tarball (' + state.percent + '%)';

        }).on('error', function(err){

          app.actions[key].status = 'error';
          app.actions[key].description = 'Failed to download /' + stack.repo + '/tarball/' + branch + ' tarball';
          return cb('error-download-tarball');

        }).pipe(fs.createWriteStream(tmp + 'tmp.tar.gz')).on('close', function(){

          app.actions[key].description = 'Deflating ' + repo + ' master\'s tarball';

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
      build: function(branch, cb){

        // Build all the targets that requires us to be built.
        async.each(app.config.targets.stacks, function(stack, cb){

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
            downloadAndExtractTarball(key, stack, stack.mobile.repo, branch, function(){
              downloadAndExtractTarball(key, stack, stack.repo, branch, function(){

                // Call the build script for this target.
                stack.mobile.build(key, cb);

              });
            });

          });

        }, cb);

      }
    };

    // POST /mobile/build - Create all mobile builds from master branch.
    app.post('/mobile/build', function(req, res){

      res.redirect('/');
      return methods.build('master');

    });

    return methods;

  };

})();