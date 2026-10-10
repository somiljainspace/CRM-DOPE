#!/bin/bash
mkdir -p test-certs
openssl req -x509 -newkey rsa:2048 -nodes -keyout test-certs/key.pem -out test-certs/cert.pem -days 365 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
