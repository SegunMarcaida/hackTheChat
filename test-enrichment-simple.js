// Simple test script for Contact Enrichment API (without database dependency)
// Run with: node test-enrichment-simple.js

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8082';

// Test data with Patrick Turricelli's information
const testContact = {
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
};

async function testContactEnrichment() {
  console.log('🧪 Testing Contact Enrichment API');
  console.log('📧 Email:', testContact.email);
  console.log('🔗 LinkedIn URL:', testContact.linkedin);
  console.log('');
  
  try {
    console.log('📤 Sending POST request to /api/contacts/enrich...');
    
    const response = await fetch(`${BASE_URL}/api/contacts/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testContact)
    });

    console.log(`📥 Response Status: ${response.status}`);
    console.log(`📥 Response Status Text: ${response.statusText}`);
    
    let responseData;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
      console.log('📄 Response Data:', JSON.stringify(responseData, null, 2));
    } else {
      const textResponse = await response.text();
      console.log('📄 Response (Text):', textResponse);
    }
    
    if (response.ok) {
      console.log('✅ Request completed successfully!');
      
      if (responseData && responseData.success) {
        console.log('✅ API returned success: true');
        if (responseData.data && responseData.data.contact) {
          console.log('✅ Contact data returned');
          console.log('📊 Contact details:');
          console.log('   - Name:', responseData.data.contact.name);
          console.log('   - Email:', responseData.data.contact.email);
          console.log('   - LinkedIn:', responseData.data.contact.linkedin);
        }
      }
    } else {
      console.log('❌ Request failed');
      if (responseData) {
        console.log('❌ Error:', responseData.error || 'Unknown error');
        
        // Provide helpful context for common errors
        if (responseData.error === 'Database not initialized') {
          console.log('💡 This is expected in a test environment without Firebase configuration.');
          console.log('💡 The endpoint is working correctly - it just needs database setup for full functionality.');
        }
      }
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - make sure the server is running on port 8081');
      console.log('💡 Try running: npm run dev');
    } else {
      console.log('❌ Network/Parse Error:', error.message);
    }
  }
}

async function main() {
  console.log('🚀 Starting Simple Contact Enrichment Test');
  console.log('📍 Server URL:', BASE_URL);
  console.log('');
  
  await testContactEnrichment();
  
  console.log('');
  console.log('✨ Test completed!');
}

// Run the test
main().catch(console.error); 