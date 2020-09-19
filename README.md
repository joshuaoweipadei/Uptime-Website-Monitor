# Uptime-Website-Monitor

Uptime Website Monitor Application built with NodeJs. No frameworks, No dependencies, just plain NodeJs and its core in-built modules.

#### Setting up the HTTPS SSL Certificate

Here are the steps in setting up the HTTPS SSL Certificate: In the root directory
```
mkdir https
cd https
```

Run this command in your terminal to create a SSL Cert:
> $ openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem

Answer the few questions you will be prompted with, and you are done creating the HTTPS SSL Cretificate for this project.
