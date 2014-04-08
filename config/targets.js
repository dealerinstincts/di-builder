/**
 * targets.js
 * Stacks AWS information, along with their GitHub repos.
 * 
 * @author  Jason Valdron <jason@dealerinstincts.com>
 * @package di-builder
 */

(function(){
    'use strict';

    // Export the config object.
    module.exports = function(app){
    
        return {
          stacks: [
            {
              id: '4e20a08b-b158-4235-b3a3-4e76f72f5ac8',
              name: 'di-api-production',
              color: '#BA4132',
              user: 'dealerinstincts',
              repo: 'di-api',
              mobile: false
            },
            {
              id: '91139ae1-e1ec-4024-a395-2010261dad41',
              name: 'di-frontend-production',
              color: '#BA4132',
              user: 'dealerinstincts',
              repo: 'di-frontend',
              mobile: {
                repo: 'di-frontend-mobile',
                build: function(key, target, cb){

                  var exec = require('child_process').exec,
                      fs = require('fs-extra'),
                      libxmljs = require('libxmljs');

                  var tmp = process.cwd() + '/tmp/' + key + '/';

                  app.actions[key].description = 'Locating required directories';

                  // Attempt to find the two folders we need, frontend and frontend-mobile
                  fs.readdir(tmp, function(err, files){

                    files.forEach(function(file){

                      // Try to find the frontend folder.
                      if (~file.indexOf('di-frontend') && !~file.indexOf('-mobile')) fs.rename(tmp + file, tmp + 'frontend');
                      if (~file.indexOf('di-frontend-mobile')) fs.rename(tmp + file, tmp + 'frontend-mobile');

                    });

                    app.actions[key].description = 'Compiling assets using sync_www.js';

                    // Run our custom WWW syncer (compiles assets).
                    var sync  = exec('/usr/bin/node ' + tmp + 'frontend-mobile/bin/sync_www.js', {
                      cwd: tmp + 'frontend-mobile/bin/'
                    }, function(err, stdout, stderr){

                      if (err) {
                        app.actions[key].status = 'error';
                        app.actions[key].description = 'Assets compilation (sync_www.js) failed with error: ' + stderr;
                        return cb('sync-www-failed');
                      }

                      app.actions[key].description = 'Preparing Android build';

                      // Run the Cordova prepare android tool.
                      var build = exec('cordova prepare android', {
                        cwd: tmp + 'frontend-mobile/'
                      }, function(err, stdout, stderr){

                        if (err) {
                          app.actions[key].status = 'error';
                          app.actions[key].description = 'Prepare (cordova prepare android) failed with error: ' + stderr;
                          return cb('prepare-failed');
                        }

                        app.actions[key].description = 'Adjusting build numbers for Android';

                        // Read the AndroidManifest.xml file.
                        fs.readFile(tmp + 'frontend-mobile/platforms/android/AndroidManifest.xml', {
                          encoding: 'utf8'
                        }, function(err, manifest){

                          // Parse the version from the XML file.
                          var xml = libxmljs.parseXml(manifest),
                              version = xml.get('//@android:versionCode', { android: 'http://schemas.android.com/apk/res/android' });

                          // Update versions.
                          xml.root().attr({
                            'android:versionCode': parseInt(version.value(), 10) + 1,
                            'android:versionName': target.branch
                          });

                          // Write out our new manifest.
                          fs.writeFile(tmp + 'frontend-mobile/platforms/android/AndroidManifest.xml', xml.toString(), {
                            encoding: 'utf8'
                          }, function(){

                            app.actions[key].description = 'Building Android release APK file';

                            // Run the Cordova platform build tool.
                            var build = exec(tmp + 'frontend-mobile/platforms/android/cordova/build --release', {
                              cwd: tmp + 'frontend-mobile/platforms/android/cordova'
                            }, function(err, stdout, stderr){

                              if (err) {
                                app.actions[key].status = 'error';
                                app.actions[key].description = 'Build (build --release) failed with error: ' + stderr;
                                return cb('build-failed');
                              }

                              var unsigned = tmp + 'frontend-mobile/platforms/android/ant-build/DealerInstincts-release-unsigned.apk',
                                  unaligned = tmp + 'frontend-mobile/platforms/android/ant-build/DealerInstincts-release-unaligned.apk';

                                // Create a new APK for the unaligned version, just easier to track.
                              fs.copy(unsigned, unaligned, function(err){

                                if (err) {
                                  app.actions[key].status = 'error';
                                  app.actions[key].description = 'Copy unsigned APK failed with error: ' + err;
                                  return cb('copy-unsigned-failed');
                                }

                                app.actions[key].description = 'Signing the APK file';

                                // Sign the APK file.
                                var signer = exec('jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -storepass sierra1 -keystore ' + process.cwd() + '/config/keys/di-frontend-mobile.keystore ' + unaligned + ' di_frontend_mobile', function(err, stdout, stderr){

                                  if (err) {
                                    app.actions[key].status = 'error';
                                    app.actions[key].description = 'Error signing the APK file: ' + stderr;
                                    return cb('jarsigner-failed');
                                  }

                                  app.actions[key].description = 'Aligning the APK file';

                                  var build = process.cwd() + '/builds/' + key + '.apk';

                                  // Sign the APK file.
                                  var signer = exec('zipalign -v 4 ' + unaligned + ' ' + build, function(err, stdout, stderr){

                                    if (err) {
                                      app.actions[key].status = 'error';
                                      app.actions[key].description = 'Error aligning the APK file: ' + stderr;
                                      return cb('zipalign-failed');
                                    }

                                    return cb();

                                  });

                                });

                              });

                            });

                          });

                        });

                      });

                    });

                  });

                }
              }
            },
            {
              id: 'fefe0397-f115-4911-92e3-3b060983479c',
              name: 'di-api-staging',
              color: '#2D72B8',
              user: 'dealerinstincts',
              repo: 'di-api',
              mobile: false
            },
            {
              id: '0cbf3cad-86cf-4db1-b245-544c5c698917',
              name: 'di-frontend-staging',
              color: '#2D72B8',
              user: 'dealerinstincts',
              repo: 'di-frontend',
              mobile: false
            },
            {
              id: '2445751f-afe0-491b-9870-24ca5ba15c27',
              name: 'di-api-demo',
              color: '#B8852E',
              user: 'dealerinstincts',
              repo: 'di-api',
              mobile: false
            },
            {
              id: '764dcc00-b864-4efd-9dc4-cf139786a928',
              name: 'di-frontend-demo',
              color: '#B8852E',
              user: 'dealerinstincts',
              repo: 'di-frontend',
              mobile: false
            }
          ],
          tagsFrom: {
            user: 'dealerinstincts',
            repo: 'di-frontend'
          }
        };

    };

})();