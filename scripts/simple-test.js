const axios = require('axios');

async function test() {
  try {
    // Test login
    console.log('Testing login...');
    const response = await axios.post('http://localhost:8080/api/auth/login', {
      email: 'admin@example.com',
      password: 'Admin123!'
    });

    console.log('Login successful!');
    const token = response.data.data.tokens.accessToken;
    console.log('Token:', token.substring(0, 50) + '...');

    // Test units endpoint
    console.log('\nTesting units endpoint...');
    const unitsResponse = await axios.get('http://localhost:8080/api/units', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Units endpoint works!');
    console.log('Units response:', JSON.stringify(unitsResponse.data, null, 2));

    // Test handover endpoint
    console.log('\nTesting handover endpoint...');
    const handoversResponse = await axios.get('http://localhost:8080/api/handovers', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Handover endpoint works!');
    console.log('Response:', handoversResponse.data);

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

test();