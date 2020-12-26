/*
 *
 *
 * These are all related files
 *
 */

// Dependecies
var path = require('path');
var fs = require('fs');
var _data = require('./data');
var http = require('http')
var https = require('https')
var helpers = require('./helpers');
var url = require('url');
var _logs = require('./logs');
var util = require('util');
var debug = util.debuglog('workers');

// Instantiate the worker object
var workers = {};

// Lookup all checks, get their data, send to a validator
workers.gatherAllChecks = function(){
    // Get all the checks
    _data.list('checks', function(err, checks){
        if(!err && checks && checks.length > 0){
            checks.forEach(function(check){
                // Read in the check data
                _data.read('checks', check, function(err, originalCheckData){
                    if(!err && originalCheckData){
                        // Pass it to the check validator, and let that function continue or
                        workers.validateCheckData(originalCheckData);
                    } else {
                        debug('Error reading one of the check\'s data ', err);
                    }
                });
            });
        } else {
            debug('Error: Could not find any checks to process');
        }
    });
}

// Sanity-checking the check-data
workers.validateCheckData = function(originalCheckData){
    originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {};
    originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
    originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone.trim() : false;
    originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['http', 'https'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
    originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
    originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
    originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
    originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

    // Set the keys that may not be set (if the workers have never seen this check before)
    originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
    originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

    // If all the check pass, pass the data along to the next step in the process
    if(originalCheckData.id &&
        originalCheckData.userPhone &&
        originalCheckData.protocol &&
        originalCheckData.url &&
        originalCheckData.method &&
        originalCheckData.successCodes &&
        originalCheckData.timeoutSeconds){
            workers.performCheck(originalCheckData);
        } else {
            debug("Error: One of the checks is not properly formatted. Skipping it");
        }
};

// Perform the check, set the orignalCheckData and the outcome of the check process, to the next step in the process
workers.performCheck = function(originalCheckData){
    // Perpare the initial check outcome
    var checkOutcome = {
        'error' : false,
        'responseCode': false,
    }

    // Mark that the outcome has not been sent yet
    var outcomeSent = false;

    // Parse the hostname and the path out of the original check data
    var parsedUrl = url.parse(originalCheckData.protocol+'://'+originalCheckData.url, true);
    var hostName = parsedUrl.hostname;
    var path = parsedUrl.path // Using path and not pathname because we want the query string

    // Construct the request
    var requestDetails = {
        'protocol': originalCheckData.protocol+':',
        'hostname': hostName,
        'method': originalCheckData.method.toUpperCase(),
        'path': path,
        'timeout': originalCheckData.timeoutSeconds + 1000
    };

    // Instantiate the request object (using either the http or https module)
    var _moduleToUse = originalCheckData.protocol == 'http' ? http : https;
    var req = _moduleToUse.request(requestDetails, function(res){
        // Grab the status of the request
        var status = res.statusCode;

        // Update the checkOutcome and pass the data along
        checkOutcome.responseCode = status;
        if(!outcomeSent){
            workers.procesCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // Bind to the error event so it doesn't get thrown
    req.on('error', function(e){
        // Update the checkOutcome and pass the data along
        checkOutcome.error = {
            'error' : true,
            'value' : e
        };
        if(!outcomeSent){
            workers.procesCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // Bind to the timeout event
    req.on('timeout', function(){
        // Update the checkOutcome and pass the data along
        checkOutcome.error = {
            'error' : true,
            'value' : 'timeout'
        };
        if(!outcomeSent){
            workers.procesCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // End the request 
    req.end();
}

// Process the check outcome , update the cehck data as neede, trigger an alert if neede
// Special login for accommdating a cehc that has never been tested before (don't alert on that one)

workers.procesCheckOutcome = function(originalCheckData, checkOutcome){
    //  Decide if the check is considered up or down
    var state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';

    // Decide if an alert is warranted
    var alertWarranted = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false;

    // Log the outcome
    var timeOfCheck = Date.now();
    workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

    // Update the check data
    var newCheckData = originalCheckData;
    newCheckData.state = state;
    newCheckData.lastChecked = timeOfCheck;

    // save the updates
    _data.update('checks', newCheckData.id, newCheckData, function(err){
        if(!err){
            if(alertWarranted){
                workers.alertUserToStatusChange(newCheckData);
            } else {
                debug('Check outcome has not changed, no alert needed');
            }
        } else {
            debug('Error trying to save updates to one of the checks');
        }
    });
}

// Alert the user as to a chenge in theri check status
workers.alertUserToStatusChange = function(newCheckData){
    var msg = 'Alert: Your check for '+newCheckData.method.toUpperCase() + ' '+newCheckData.protocol+'://'+newCheckData.url+' is currently '+newCheckData.state;

    helpers.sendTwilioSms(newCheckData.userPhone, msg, function(err){
        if(!err){
            debug('Success: User was alerts to a status change in their check, via sms: ', msg);
        } else {
            debug('Error: Could not send sms alert to user who had a state change in their check');
        }
    });
}

workers.log = function(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck){
    // Form the log
    var logData = {
        'check': originalCheckData,
        'outcome': checkOutcome,
        'state': state,
        'alert': alertWarranted,
        'time': timeOfCheck
    };

    // Comvert data to a string
    var logString = JSON.stringify(logData);

    // Determine the name of the log file
    var logFileName = originalCheckData.id;

    // Append the log string to the file
    _logs.append(logFileName, logString, function(err){
        if(!err){
            debug('Logging to file succeeded');
        } else {
            debug('Logging to file failed');
        }
    })
}


// Timer to execute  the workers-process once per minute
workers.loop = function(){
    setInterval(function(){
        workers.gatherAllChecks();
    }, 1000 * 60);
}

workers.rotateLogs = function(){
    // List all the (non compressed) log files
    _logs.list(false, function(err, logs){
        if(!err && logs && logs.length > 0){
            logs.forEach(function(logName){
                // Compress the data to a different file
                var logId = logName.replace('.log','');
                var newFileId = logId+'-'+Date.now();
                _logs.compress(logId, newFileId, function(err){
                    if(!err){
                        // Truncate the log
                        _logs.truncate(logId, function(err){
                            if(!err){
                                debug('Success truncating logFile');
                            } else {
                                debug('Error truncating logFile');
                            }
                        });
                    } else {
                        debug('Error compressing of the log files', err);
                    }
                });
            });
        } else {

        }
    });
}

// Timer to execute the log-rotation precess once per day
workers.logRotationLoop = function(){
    setInterval(function(){
        workers.rotateLogs();
    }, 1000 * 60 * 60 * 24);
}

// Init script
workers.init = function(){

    // Send to console in yellow
    console.log('\x1b[33m%s\x1b[0m', 'Background workers are running');

    // Execute all the checks immediately
    workers.gatherAllChecks();

    // Call the loop so the checks will execute later on
    workers.loop();

    // Compress all the logs immediately
    workers.rotateLogs();

    // Call the compression loop so logs will be compressed later on
    workers.logRotationLoop();

}

// Export the module
module.exports = workers;