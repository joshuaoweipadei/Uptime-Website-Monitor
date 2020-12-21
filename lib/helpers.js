/*
 * Helpers for various task
 */

var crypto = require('crypto');
var config = require('./config');
var https = require('https');
var queryString = require('querystring')
//  Container for all the helpers
var helpers = {};

// Hash user password
helpers.hash = function(str){
    if(typeof(str) == 'string' && str.length > 0){
        var hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
        return hash
    } else{
        return false;
    }
}

// Parse a JSON string to an object in all cases, without throwing
helpers.parseJsonToObject = function(str){
    try {
        var obj = JSON.parse(str);
        return obj;
    } catch(e){
        return {}
    }
}

// Create a string of random alphanumeric character of a given length
helpers.createRandomString = function(strLength){
    strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
    if(strLength){
        // Define  all the possible character that could go into a string
        var possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

        // Sort the final string
        var str = '';
        for(i = 1; i <= strLength; i++) {
            // ?Get a random character from the posible character string
            var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
            // Append this charater to the final string
            str += randomCharacter;
        }
        // Return the final string
        return str
    } else {
        return false;
    }
}



// Send an SMS message via Twilio
helpers.sendTwilioSms = function(phone, msg, callback){
    // validate parameters
    var phone = typeof(phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false;
    var msg = typeof(msg) == 'string' && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg.trim() : false;
     if(phone && msg){
        // Configure the request payload
        var payload = {
            'From': config.twilio.fromPhone,
            'To': '+1'+phone,
            'Body': msg
        };

        // Stringify the payload
        var stringPayload = queryString.stringify(payload);

        // Configure the request details
        var requestDetails = {
            'protocol': 'https:',
            'hostname': 'api.twilio.com',
            'method': 'POST',
            'path': '/2010-04-01/Accounts/'+config.twilio.accountSid+'/Messages.json',
            'auth': config.twilio.accountSid+':'+config.twilio.authToken,
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded',
                'content-Length': Buffer.byteLength(stringPayload)
            }
        };

        // Instantiate the request object
        var req = https.request(requestDetails, function(res){
            // Grab the status of the sent request
            var status = res.statusCode;
            // Callback successfully if the request went through
            if(status == 200 || status == 201){
                callback(false);
            } else {
                callback('Status code returned was ' + status);
            }
        });

        // Bind to the erro event so it does'nt get thrown
        req.on('error', function(e){
            callback(e);
        });

        // Add the payload
        req.write(stringPayload);

        // End the request
        req.end();

     } else {
         callback('Given parameters were missing on invalid')
     }
}


module.exports = helpers;