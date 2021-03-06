/*
 *
 * Server-related tasks
 * 
 */


//  Dependecies
var http = require('http');
var https = require('https');
var url = require('url');
var StringDecoder = require('string_decoder').StringDecoder;
var fs = require('fs');
var config = require('../lib/config');
var handlers = require('../lib/handlers');
var helpers = require('../lib/helpers');
var path = require('path');
var util = require('util');
var debug = util.debuglog('server');

// Instantiate the server module object
var server = {

};

// Instantiate the HTTP server
server.httpServer = http.createServer(function(req, res){
    server.unifiedServer(req, res)
});

// Instantiate the HTTPS server
server.httpsServerOptions = {
    'key': fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
    'cert': fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
}
server.httpsServer = https.createServer(server.httpsServerOptions, function(req, res){
    server.unifiedServer(req, res)
});



// All the server logic for both http and https
server.unifiedServer = function(req, res){

    // get the url and parse it
    var parseUrl = url.parse(req.url, true);

    // get the path
    var path = parseUrl.pathname;
    var trimmedPath = path.replace(/^\/+|\/+$/g, '')

    // get the query string as an object
    var queryStringObject = parseUrl.query;

    // get the HTTP method
    var method = req.method.toLowerCase();

    // get the headers as an object
    var headers = req.headers

    // get the payload if any
    var decoder = new StringDecoder('utf-8');
    var buffer = '';
    req.on('data', function(data){
        buffer += decoder.write(data)
    });
    req.on('end', function(){
        buffer += decoder.end()

        // Choose the handler this request should go to. If one is not found go to NotFound handler
        var chosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

        // Construct the data object to send to the handler
        var data = {
            'trimmedPath': trimmedPath,
            'queryStringObject': queryStringObject,
            'method': method,
            'headers': headers,
            'payload': helpers.parseJsonToObject(buffer)
        };

        // Router the request to the handlers specified in the router
        chosenHandler(data, function(statusCode, payload){
            // Use the statusCode called back by the handler, or default to 200
            statusCode = typeof(statusCode) == 'number' ? statusCode : 200;

            // Use the payload called back by the handler, or defaut to an empty object
            payload = typeof(payload) == 'object' ? payload : {};

            // Convert the payload to a string
            var payloadString = JSON.stringify(payload);

            // Return the response
            res.setHeader('Content-Type', 'application/json')
            res.writeHead(statusCode);

            // send the response
            res.end(payloadString);

            // If the response is 200 print green otherwise print red
            if(statusCode == 200){
                debug('\x1b[32m%s\x1b[0m', method.toUpperCase()+' /'+trimmedPath+' '+statusCode);
            } else {
                debug('\x1b[31m%s\x1b[0m', method.toUpperCase()+' /'+trimmedPath+' '+statusCode);
            }
        });
    });
};


// Define a request router
server.router = {
    'ping': handlers.ping,
    'users': handlers.users,
    'tokens': handlers.tokens,
    'checks': handlers.checks
}

// Init script
server.init = function(){
    // Start the HTTP server
    server.httpServer.listen(config.httpPort, function(){
        console.log('\x1b[36m%s\x1b[0m', 'The server is listening on port '+config.httpPort);

    });

    // Start the HTTPS server
    server.httpsServer.listen(config.httpsPort, function(){
        console.log('\x1b[35m%s\x1b[0m', 'The server is listening on port '+config.httpsPort);
    });
}

// Export the module
module.exports = server;