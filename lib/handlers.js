/*
 * This are the Handlers
 */


// Define the handlers
var handlers = {};

// User handler
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
}

handlers._users.get = function(data, callback){
    
}

handlers._users.put = function(data, callback){
    
}

handlers._users.delete = function(data, callback){
    
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