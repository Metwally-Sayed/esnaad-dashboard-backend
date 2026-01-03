#!/bin/bash

curl -s -X PUT "http://localhost:8080/api/users/cmjw93u260000186cgpb3n3r2" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImY5ZGI0ZGM3LWQyZTctNGE1Yy05NWFiLTdhY2FjZGIwZWU3YiIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NjczOTk5NTgsImV4cCI6MTc2ODAwNDc1OH0.jC7aqibH5vPGqyNwCFoJeliyn3LpRLbtXv7YQ4_aTFs" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+966501234567",
    "address": "123 King Fahd Road, Riyadh 12345, Saudi Arabia",
    "nationalId": "1234567890"
  }' | jq