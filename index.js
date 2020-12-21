/*
 *
 * Author : Joshua Oweipadei Bayefa
 * Date : 14 September 2020
 * Description: Uptime Website Monitor with plain NodeJs. No Frameworks, No Dependencies.
 * 
 * Primary file for the API
 * 
 */

// Dependecies
var server = require('./lib/server');
var workers = require('./lib/workers')

// Declare the app
var app = {};

// Init function
app.init = function(){
    // Start the server
    server.init();

    // Srart the workers
    workers.init();
};

//  Execute
app.init();

// Export the app
module.exports = app;