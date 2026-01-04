const axios = require('axios');

async function testComplete() {
  try {
    // Login as admin
    const login = await axios.post('http://localhost:8080/api/auth/login', {
      email: 'admin@example.com',
      password: 'Admin123!'
    });
    const adminToken = login.data.data.tokens.accessToken;

    // Get handovers
    const handovers = await axios.get('http://localhost:8080/api/handovers', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const completableHandover = handovers.data.data.find(h =>
      h.status === 'ADMIN_CONFIRMED' || h.status === 'SENT_TO_OWNER'
    );

    if (!completableHandover) {
      console.log('No handover in a state ready to be completed');
      console.log('Available handovers:', handovers.data.data.map(h => ({ id: h.id, status: h.status })));
      return;
    }

    console.log('Attempting to complete handover:', completableHandover.id, 'Status:', completableHandover.status);

    const response = await axios.post(
      `http://localhost:8080/api/handovers/${completableHandover.id}/complete`,
      {},
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    console.log('Success! Handover completed');
    console.log('Document URL:', response.data.data.document?.url);

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testComplete();