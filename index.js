/*
 *
 * Author : Joshua Oweipadei Bayefa
 * Date : 14 September 2020
 * Description: Uptime Website Monitor with plain NodeJs. No Frameworks, No Dependencies.
 * 
 * Primary file for the API
 * 
 */

// NodeJs in-built Modules
var http = require('http');
var https = require('https');
var url = require('url');
var StringDecoder = require('string_decoder').StringDecoder;
var config = require('./config');
var fs = require('fs');
var handlers = require('./lib/handlers');


// Instantiate the HTTP server
var httpServer = http.createServer(function(req, res){
    unifiedServer(req, res)
});

//  Start the HTTP server, and have it listen on port 3000
httpServer.listen(config.httpPort, function(){
    console.log("The server is listening on port "+config.httpPort);
});

// Instantiate the HTTPS server
var httpsServerOptions = {
    'key': fs.readFileSync('./https/key.pem'),
    'cert': fs.readFileSync('./https/cert.pem')
}
var httpsServer = https.createServer(httpsServerOptions, function(req, res){
    unifiedServer(req, res)
});

// Start the HTTPS server
httpsServer.listen(config.httpsPort, function(){
    console.log("The server is listening on port "+config.httpsPort);
});

// All the server logic for both http and https
var unifiedServer = function(req, res){

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
        var chosenHandler = typeof(router[trimmedPath]) !== 'undefined' ? router[trimmedPath] : handlers.notFound;

        // Construct the data object to send to the handler
        var data = {
            'trimmedPath': trimmedPath,
            'queryStringObject': queryStringObject,
            'method': method,
            'headers': headers,
            'payload': buffer
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

            console.log('Returning this response: ', statusCode, payloadString)
        });

    });
};


// Define a request router
var router = {
    'ping': handlers.ping,
    'users': handlers.users
}