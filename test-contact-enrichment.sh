#!/bin/bash

# Test Contact Enrichment Endpoint
# Make sure your server is running first (npm run dev)

echo "Testing Contact Enrichment Endpoint with Patrick Turricelli's data..."

# Sample contact data with LinkedIn URL
curl -X POST http://localhost:8081/api/contacts/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-contact-patrick",
    "name": "Patrick Turricelli",
    "firstName": "Patrick",
    "lastName": "Turricelli",
    "linkedin": "https://www.linkedin.com/in/patrick-turricelli/",
    "email": "patrick@gomry.com",
    "organizationID": "test-org-patrick",
    "jobHistory": [],
    "educationHistory": [],
    "location": {
      "city": "",
      "state": "",
      "country": ""
    }
  }' \
  | jq '.' || echo "Response received (jq not installed for formatting)"

echo -e "\n\nTest completed!" 