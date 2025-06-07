// Test script for Contact Enrichment API
// Run with: node test-enrichment.js

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8081';

// Test data
const testContacts = [
  {
    id: "test-contact-patrick",
    name: "Patrick Turricelli",
    firstName: "Patrick",
    lastName: "Turricelli",
    linkedin: "https://www.linkedin.com/in/patrick-turricelli/",
    email: "patrick@gomry.com",
    organizationID: "test-org-patrick",
    jobHistory: [],
    educationHistory: [],
    location: { city: "", state: "", country: "" }
  },
  {
    id: "test-contact-2", 
    name: "Satya Nadella",
    firstName: "Satya",
    lastName: "Nadella",
    linkedin: "https://www.linkedin.com/in/satyanadella/",
    email: "test2@example.com",
    organizationID: "test-org-2",
    jobHistory: [],
    educationHistory: [],
    location: { city: "", state: "", country: "" }
  }
];

async function testContactEnrichment(contact, testName) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log(`LinkedIn URL: ${contact.linkedin}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/contacts/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contact)
    });

    const responseData = await response.json();
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log('Response preview:', {
        success: responseData.success,
        contactName: responseData.data?.contact?.name,
        jobHistoryCount: responseData.data?.contact?.jobHistory?.length || 0,
        educationCount: responseData.data?.contact?.educationHistory?.length || 0
      });
    } else {
      console.log('❌ Error!');
      console.log('Error details:', responseData);
    }
    
  } catch (error) {
    console.log('❌ Network/Parse Error:', error.message);
  }
}

async function testErrorCases() {
  console.log('\n🧪 Testing Error Cases');
  
  // Test 1: No LinkedIn URL
  console.log('\n📝 Test: Contact without LinkedIn URL');
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
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 2: Empty body
  console.log('\n📝 Test: Empty request body');
  try {
    const response = await fetch(`${BASE_URL}/api/contacts/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await response.json();
    console.log(`Status: ${response.status}, Message: ${data.error}`);
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function main() {
  console.log('🚀 Starting Contact Enrichment API Tests');
  console.log('Make sure your server is running on http://localhost:8081');
  
  // Test server connectivity
  try {
    const healthCheck = await fetch(`${BASE_URL}/health`).catch(() => null);
    if (!healthCheck) {
      console.log('❌ Server not responding. Make sure to run: npm run dev');
      return;
    }
  } catch (error) {
    console.log('⚠️  Could not verify server status, proceeding anyway...');
  }

  // Test valid contacts
  for (let i = 0; i < testContacts.length; i++) {
    await testContactEnrichment(testContacts[i], `Contact ${i + 1} - ${testContacts[i].name}`);
  }

  // Test error cases
  await testErrorCases();

  console.log('\n✨ All tests completed!');
}

// Run the tests
main().catch(console.error); 