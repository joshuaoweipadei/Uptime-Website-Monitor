/*
 * This are the Handlers
 */

//  Dependencies
var helpers = require('./helpers');
var _data = require('./data');
var config = require('./config');


// Define the handlers
var handlers = {};

/*
 *
 * User handler
 *
 */
handlers.users = function(data, callback){
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._users[data.method](data, callback);
    } else{
        callback(405);
    }
}

// Container for the users submethods
handlers._users = {};

// User - post
// Request data: firstname, lastname, phone, password, tosAgreement
// Optional data: none
handlers._users.post = function(data, callback){
    // Check that all required fields are filled out
    var firstname = typeof(data.payload.firstname) == 'string' && data.payload.firstname.trim().length > 0 ? data.payload.firstname.trim() : false;
    var lastname = typeof(data.payload.lastname) == 'string' && data.payload.lastname.trim().length > 0 ? data.payload.lastname.trim() : false;
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 11 ? data.payload.phone.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    var tosAgreement = typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false;

    if(firstname && lastname && phone && password && tosAgreement){
        // make sure the user doesnt already exist
        _data.read('users', phone, function(err, data){
            if(err){
                // Hash the password
                var hashedPassword = helpers.hash(password);

                if(hashedPassword){
                    // Create the user object
                    var userObject = {
                        'firstname': firstname,
                        'lastname': lastname,
                        'phone': phone,
                        'hashedPassword': hashedPassword,
                        'tosAgreement': true,
                    }

                    // Store the user
                    _data.create('users', phone, userObject, function(err){
                        if(!err){
                            callback(200);
                        } else{
                            console.log(err);
                            callback(500, {'Error': 'Could not create the new user'});
                        }
                    });

                } else{
                    callback(500, {'Error': 'Could not hash user\'s password'});
                }
            } else{
                callback(400, {'Error': 'A user with that phone number already exist'});
            }
        })
    } else{
        callback(400, {'Error': 'Missing required fields'});
    }
}


// Users - get
// Required data: phone
// Optional data : none
handlers._users.get = function(data, callback){
    // Check that the phone number is valid
    var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 11 ? data.queryStringObject.phone.trim() : false;
    if(phone){
        // Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid for the phone nuber
        handlers._tokens.verifyToken(token, phone, function(tokenIsValid){
            if(tokenIsValid){
                // Look up the user
                _data.read('users', phone, function(err, data){
                    if(!err && data){
                        // Remove the hashed password from the user object before rreturning it to the requester
                        delete data.hashedPassword;
                        callback(200, data);
                    } else {
                        callback(404);
                    }
                });
            } else {
                callback(403, {'Error': 'Missing required token in header, or token is invalid'});
            }
        });
    } else{
        callback(400, {'Error': 'Missing required field'});
    }
}


// User - put
// Required data : phone
// Optional data: firstname, lastname, password (at least one must be specified)
handlers._users.put = function(data, callback){
    // Check that the phone number is valid
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 11 ? data.payload.phone.trim() : false;

    // Check for the optional fields
    var firstname = typeof(data.payload.firstname) == 'string' && data.payload.firstname.trim().length > 0 ? data.payload.firstname.trim() : false;
    var lastname = typeof(data.payload.lastname) == 'string' && data.payload.lastname.trim().length > 0 ? data.payload.lastname.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    
    if(phone){
        if(firstname || lastname || password){

            // Get the token from the headers
            var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
            // Verify that the given token is valid for the phone nuber
            handlers._tokens.verifyToken(token, phone, function(tokenIsValid){
                if(tokenIsValid){
                    // Look up the user
                    _data.read('users', phone, function(err, userData){
                        if(!err && userData){
                            // Update the fields that are necessary
                            if(firstname){
                                userData.firstname = firstname;
                            }
                            if(lastname){
                                userData.lastname = lastname;
                            }
                            if(password){
                                userData.hashedPassword = helpers.hash(password);
                            }

                            _data.update('users', phone, userData, function(err){
                                // Store the now update
                                if(!err){
                                    callback(200);
                                } else{
                                    console.log(err);
                                    callback(500, {'Error': 'Could not update the user'});
                                }
                            });
                        } else{
                            callback(400, {'Error': 'The specified user does not exist'});
                        }
                    })
                } else {
                    callback(403, {'Error': 'Missing required token in header, or token is invalid'});
                }
            });

        } else{
            callback(400, {'Error': 'Missing fields to update'})
        }
    } else{
        callback(400, {'Error': 'Missing required field'})
    }
}


// User -delete
// Required data : phone
handlers._users.delete = function(data, callback){
    // Check that the phone number is valid
    var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 11 ? data.queryStringObject.phone.trim() : false;
    if(phone){
        // Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid for the phone nuber
        handlers._tokens.verifyToken(token, phone, function(tokenIsValid){
            if(tokenIsValid){
                // Look for user
                _data.read('users', phone, function(err, userData){
                    if(!err && data){
                        _data.delete('users', phone, function(err){
                            if(!err){
                                // Delete if of the checks associated with the checks
                                var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                                var checksToDelete = userChecks.length;
                                if(checksToDelete > 0){
                                    var checksDeleted = 0;
                                    var deletionErrors = false;
                                    // Loop through the checks
                                    userChecks.forEach(function(checkId){
                                        // Delete th check
                                        _data.delete('checks', checkId, function(err){
                                            if(!err){
                                                deletionErrors = true;
                                            }
                                            checksDeleted++;
                                            if(checksDeleted == checksToDelete){
                                                if(!deletionErrors){
                                                    callback(200);
                                                } else {
                                                    callback(500, {'Error': 'Errors encountered while attempting to delete all of the user\'s checks. All checks may not have been deleted from the system successfully'});
                                                }
                                            }
                                        })
                                    })
                                } else {
                                    callback(200)
                                }
                            } else{
                                callback(500, {'Error': 'Could not delete the specified user'});
                            }
                        })
                    } else{
                        callback(400, {'Error': 'Could not find the specified user'});
                    }
                })
            } else {
                callback(403, {'Error': 'Missing required token in header, or token is invalid'});
            }
        });

    } else{
        callback(400, {'Error': 'Missing required field'});
    }
}


/*
 *
 * Tokens
 *
 */
handlers.tokens = function(data, callback){
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._tokens[data.method](data, callback);
    } else{
        callback(405);
    }
}

// contianer ffal all the tokens methods
handlers._tokens = {}

// Tokens - POST
handlers._tokens.post = function(data, callback){
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 11 ? data.payload.phone.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    if(phone && password){
        // Lookup the user who matches that phone number
        _data.read('users', phone, function(err, userData){
            if(!err && userData){
                // Hash the sent password and compare it to the password stored in the user object
                var hashedPassword = helpers.hash(password);
                if(hashedPassword == userData.hashedPassword){
                    // if valid create a new token Set expiration date to 1 hour in the future
                    var tokenId = helpers.createRandomString(20);
                    var expires = Date.now() * 1000 * 60 * 60;
                    var tokenObject = {
                        'phone': phone,
                        'id': tokenId,
                        'expires': expires
                    };

                    // Store the token
                    _data.create('tokens', tokenId, tokenObject, function(err){
                        if(!err){
                            callback(200, tokenObject);
                        } else{
                            callback(500, {'Error': 'Could not create the new token'});
                        }
                    });
                } else{
                    callback(400, {'Error': 'Password did not match the specified user\'s stored'});
                }
            } else{
                callback(400, {'Error': 'Could not find the specified user'});
            }
        });

    } else{
        callback(400, {'Error': 'Missing required field(s)'});
    }
}

// Tokens - GET
// Required data : id
// Opitional data : none
handlers._tokens.get = function(data, callback){
    // Check that the id is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if(id){
        // Look for tokens
        _data.read('tokens', id, function(err, tokenData){
            if(!err && tokenData){
                callback(200, tokenData);
            } else{
                callback(404);
            }
        });
    } else{
        callback(400, {'Error': 'Missing required field'});
    }
}

// Tokens - PUT
// Required data : id, expired
// Opitional data : none
handlers._tokens.put = function(data, callback){
    var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
    var extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;
    if(id && extend) {
        // Lookup the token
        _data.read('tokens', id, function(err, tokenData){
            if(!err && tokenData){
                // Check to the make sure the token isn't already expired
                if(tokenData.expires > Date.now()){
                    // Set the expiration an hour from now
                    tokenData.expires = Date.now() + 1000 * 60 * 60;

                    // Store the new update
                    _data.update('tokens', id, tokenData, function(err){
                        if(!err) {
                            callback(200);
                        } else {
                            callback(500, {'Error': 'Could not update the token\'s expiration'});
                        }
                    });
                } else {
                    callback(400, {'Error': 'The token has already expired, and cannot be extended'})
                }
            } else {
                callback(400, {'Error': 'Specificed token does not exist'});
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field(s) or field(s) are invalid'});
    }
}

// Tokens - POST
// Required data : id
// Optional data : none
handlers._tokens.delete = function(data, callback){
    // Check that the id is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if(id){
        // Look for user
        _data.read('tokens', id, function(err, data){
            if(!err && data){
                _data.delete('tokens', id, function(err){
                    if(!err){
                        callback(200)
                    } else{
                        callback(500, {'Error': 'Could not delete the specified token'});
                    }
                })
            } else{
                callback(400, {'Error': 'Could not find the specified token'});
            }
        })
    } else{
        callback(400, {'Error': 'Missing required field'});
    }
};


// Verify if a given id is currently valid for a given user
handlers._tokens.verifyToken = function(id, phone, callback){
    // Lookup the token
    _data.read('tokens', id, function(err, tokenData){
        if(!err && tokenData){
            // Check that the token is for given user and has not expired
            if(tokenData.phone == phone && tokenData.expires > Date.now()){
                callback(true);
            } else {
                callback(false);
            }
        } else {
            callback(false);
        }
    })
}


/*
 *
 * Checks
 * 
 */
handlers.checks = function(data, callback){
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._checks[data.method](data, callback);
    } else{
        callback(405);
    }
}

// contianer for all the checks mehods
handlers._checks = {}


// Checks - POST
// Required data: protocol, url, methods, successCodes, timeoutSeconds
// Optional data: none
handlers._checks.post = function(data, callback){
    // Validate inputs
    var protocol = typeof(data.payload.protocol) == 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    var method = typeof(data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;
    
    if(protocol && url && method && successCodes && timeoutSeconds){
        // Get the tokens from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        // Lookup the user by reading the token
        _data.read('tokens', token, function(err, tokenData){
            if(!err && tokenData){
                var userPhone = tokenData.phone;
                // Lookup the user data
                _data.read('users', userPhone, function(err, userData){
                    if(!err && userData){
                        var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                        // Verofy that the user hass laess than the number of max-checks-per-user
                        if(userChecks.length < config.maxChecks){
                            // Create a random id for the check
                            var checkId = helpers.createRandomString(20);

                            // check the check object and includes the user's phone
                            var checkObject = {
                                'id': checkId,
                                'userPhone': userPhone,
                                'protocol': protocol,
                                'url': url,
                                'method': method,
                                'successCodes': successCodes,
                                'timeoutSeconds': timeoutSeconds
                            }

                            // Save the objects
                            _data.create('checks', checkId, checkObject, function(err){
                                if(!err){
                                    // Add the check id to the user object
                                    userData.checks = userChecks;
                                    userData.checks.push(checkId);

                                    // Save the new user data
                                    _data.update('users', userPhone, userData, function(err){
                                        if(!err){
                                            // Return the data about the new check
                                            callback(200, checkObject)
                                        } else {
                                            callback(500, {'Error': 'Could not update the user with the new check'})
                                        }
                                    })
                                } else {
                                    callback(500, {'Error': 'Could not create the new check'});
                                }
                            })
                        } else {
                            callback(400, {'Error': 'The user already has the maximum number of checks ('+config.maxChecks+')'})
                        }
                    } else {
                        callback(403);
                    }
                });
            } else {
                callback(403);
            }
        })
    } else {
        callback(400, {'Error': 'Missing inputs, or inpus are invalid'});
    }
}


// Checks - GET
// Required data: id
// Optional data: none
handlers._checks.get = function(data, callback){
    // Check that the phone number is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if(id){
        // Look up the checks
        _data.read('checks', id, function(err, checkData){
            if(!err && checkData){
                // Get the token from the headers
                var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                // Verify that the given token is valid and belongs to the user who creates the checks
                handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid){
                    if(tokenIsValid){
                        // If token is valid return data
                        callback(200, checkData);
                    } else {
                        callback(403);
                    }
                });
            } else {
                callback(404);
            }
        });
    } else{
        callback(400, {'Error': 'Missing required field'});
    }
}

// Checks - PUT
// Required data: id
// Optional data : protocol, url, method, successCodes (one must be set)
handlers._checks.put = function(data, callback){
    // Check that the phone number is valid
    var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;

    // Check for the optional fields
    var protocol = typeof(data.payload.protocol) == 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    var method = typeof(data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

    // Check to make sure id is valid
    if(id){
        // Check to make sure one or more optional fields has been sent
        if(protocol || url || method || successCodes || timeoutSeconds){
            // Lookip the checks
            _data.read('checks', id, function(err, checkData){
                if(!err && checkData){
                    // Get the token from the headers
                    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                    // Verify that the given token is valid and belongs to the user who creates the checks
                    handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid){
                        if(tokenIsValid){
                            // If token is valid, update checks where necessary
                            if(protocol){
                                checkData.protocol = protocol;
                            }
                            if(url){
                                checkData.url = url;
                            }
                            if(method){
                                checkData.method = method;
                            }
                            if(successCodes){
                                checkData.successCodes = successCodes;
                            }
                            if(timeoutSeconds){
                                checkData.timeoutSeconds = timeoutSeconds;
                            }

                            // Store the new update
                            _data.update('checks', id, checkData, function(err){
                                if(!err){
                                    callback(200);
                                } else {
                                    callback(500, {'Error': 'Could not update the check'});
                                }
                            });
                        } else {
                            callback(403);
                        }
                    });
                } else {
                    callback(400, {'Error': 'Check ID did not exist'});
                }
            });
        } else {
            callback(400, {'Error': 'Missing fields to update'});
        }

    } else {
        callback(400, {'Error': 'Missing required field(s)'})
    }
}


// Checks - DELETE
// Required data: id
handlers._checks.delete = function(data, callback){
    // Check that the phone number is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if(id){

        // Lookup the check
        _data.read('checks', id, function(err, checkData){
            if(!err && checkData){
                // Get the token from the headers
                var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                // Verify that the given token is valid for the phone nuber
                handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid){
                    if(tokenIsValid){
                        // Delete the check data
                        _data.delete('checks', id, function(err){
                            if(!err){
                                // Look for user
                                _data.read('users', checkData.userPhone, function(err, userData){
                                    if(!err && userData){
                                        var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

                                        // Remove the deleted the check from the list of checks
                                        var checkPosition = userChecks.indexOf(id);
                                        if(checkPosition > -1){
                                            userChecks.splice(checkPosition, 1);
                                            // Re-save the user's data
                                            _data.update('users', checkData.userPhone, userData, function(err){
                                                if(!err){
                                                    callback(200);
                                                } else {
                                                    callback(500, {'Error': 'Could not update the user'})
                                                }
                                            })
                                        } else {
                                            callback(500, {'Error': 'Could not find the check on the user object, so could not remove it'});
                                        }
                                    } else{
                                        callback(500, {'Error': 'Could not find the user who created the check from the list of checks on the user object'});
                                    }
                                })
                            } else {
                                callback(500, {'Error': 'Could not delete the check data'});
                            }
                        });
                    } else {
                        callback(403);
                    }
                });
            } else {
                callback(400, {'Error': 'The specified check ID does not exist'});
            }
        });
    } else{
        callback(400, {'Error': 'Missing required field'});
    }
}



// Ping handler
handlers.ping = function(data, callback){
    // Callback a http status code, and a payload object
    callback(200)
}

// Bot found handler
handlers.notFound = function(data, callback){
    callback(404)
}


module.exports = handlers;