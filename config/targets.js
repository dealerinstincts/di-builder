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
              env: 'production'
            },
            {
              id: '91139ae1-e1ec-4024-a395-2010261dad41',
              name: 'di-frontend-production',
              color: '#BA4132',
              user: 'dealerinstincts',
              repo: 'di-frontend',
              env: 'production'
            },
            {
              id: 'fefe0397-f115-4911-92e3-3b060983479c',
              name: 'di-api-staging',
              color: '#2D72B8',
              user: 'dealerinstincts',
              repo: 'di-api',
              env: 'staging'
            },
            {
              id: '0cbf3cad-86cf-4db1-b245-544c5c698917',
              name: 'di-frontend-staging',
              color: '#2D72B8',
              user: 'dealerinstincts',
              repo: 'di-frontend',
              env: 'staging'
            },
            {
              id: '2445751f-afe0-491b-9870-24ca5ba15c27',
              name: 'di-api-demo',
              color: '#B8852E',
              user: 'dealerinstincts',
              repo: 'di-api',
              env: 'demo'
            },
            {
              id: '764dcc00-b864-4efd-9dc4-cf139786a928',
              name: 'di-frontend-demo',
              color: '#B8852E',
              user: 'dealerinstincts',
              repo: 'di-frontend',
              env: 'demo'
            }
          ],
          tagsFrom: {
            user: 'dealerinstincts',
            repo: 'di-frontend'
          }
        };

    };

})();