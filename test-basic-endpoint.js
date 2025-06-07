// Basic test for Contact Enrichment API structure
// Run with: node test-basic-endpoint.js

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8081';

async function testBasicStructure() {
  console.log('🧪 Testing API Endpoint Structure');
  
  // Test 1: Valid request structure (will fail on LinkedIn API, but should validate request format)
  console.log('\n📝 Test 1: Valid Contact Data Structure');
  try {
    const response = await fetch(`${BASE_URL}/api/contacts/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: "test-123",
        name: "Test User",
        linkedin: "https://www.linkedin.com/in/testuser/",
        email: "test@example.com",
        organizationID: "org-123"
      })
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', data);
    
    if (response.status === 500 && data.error === 'Failed to enrich contact') {
      console.log('✅ Endpoint structure is working! (Failed on LinkedIn API call as expected without API key)');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 2: Missing LinkedIn URL
  console.log('\n📝 Test 2: Missing LinkedIn URL');
  try {
    const response = await fetch(`${BASE_URL}/api/contacts/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: "test-no-linkedin",
        name: "No LinkedIn User",
        email: "test@example.com"
      })
    });
    const data = await response.json();
    console.log(`Status: ${response.status}, Message: ${data.error}`);
    
    if (response.status === 400 && data.error === 'Contact must have a LinkedIn URL to be enriched') {
      console.log('✅ Validation working correctly!');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 3: Empty body
  console.log('\n📝 Test 3: Empty Request Body');
  try {
    const response = await fetch(`${BASE_URL}/api/contacts/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await response.json();
    console.log(`Status: ${response.status}, Message: ${data.error}`);
    
    if (response.status === 400 && data.error === 'Contact must have a LinkedIn URL to be enriched') {
      console.log('✅ Empty body validation working!');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function main() {
  console.log('🚀 Testing Contact Enrichment API Structure');
  console.log('Server should be running on http://localhost:8081');
  
  await testBasicStructure();
  
  console.log('\n✨ Basic structure tests completed!');
  console.log('\n📋 Next Steps:');
  console.log('1. Set PROXYCURL_API_KEY environment variable');
  console.log('2. Export PROXYCURL_API_KEY="your-api-key-here"');
  console.log('3. Run full test with: node test-enrichment.js');
}

main().catch(console.error); 