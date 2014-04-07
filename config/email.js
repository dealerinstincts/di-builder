/**
 * email.js
 * General email settings and connection settings.
 * 
 * @author  Jason Valdron <jason@dealerinstincts.com>
 * @package di-builder
 */

(function(){
    'use strict';

    // Export the config object.
    module.exports = function(){
    
        return {
            
            from: 'Dealer Instincts <no-reply@dealerinstincts.com>',
            to: 'Developers <dev@dealerinstincts.com>',
            
            // SMTP connection information (SES is not actually SMTP).
            connection: {
                service: 'SES',
                auth: {
                    user: 'AKIAIUUGAOJCW4AJ3SCA',
                    pass: 'ArU1BLj7/xpbroprnuA5N7+H/keOBeGixlUMT2SXuZzg'
                }
            }

        };

    };

})();