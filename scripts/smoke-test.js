const app = require('../src/app');
const { pool } = require('../src/config/db');

const PORT = Number(process.env.SMOKE_PORT || 0);
const USERNAME = process.env.SMOKE_ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'AdminPass123!';

const request = async (baseUrl, method, path, { token, body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && payload.message ? payload.message : response.statusText;
    throw new Error(`${method} ${path} failed (${response.status}): ${message}`);
  }

  return payload;
};

const listen = () => new Promise((resolve) => {
  const server = app.listen(PORT, () => {
    const address = server.address();
    resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
  });
});

const main = async () => {
  const { server, baseUrl } = await listen();
  const closeServer = () => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  try {
    await request(baseUrl, 'GET', '/health');

    let auth;
    try {
      auth = await request(baseUrl, 'POST', '/api/v1/auth/register', {
        body: { username: USERNAME, password: PASSWORD }
      });
    } catch (error) {
      if (!error.message.includes('409')) throw error;
      auth = await request(baseUrl, 'POST', '/api/v1/auth/login', {
        body: { username: USERNAME, password: PASSWORD }
      });
    }

    const token = auth.data.token;
    await request(baseUrl, 'GET', '/api/v1/resources', { token });

    const createdOffice = await request(baseUrl, 'POST', '/api/v1/data/org/offices', {
      token,
      body: {
        location_name: 'Postman Smoke Office',
        city: 'Addis Ababa',
        addresses: 'Smoke test address'
      }
    });

    const officeId = createdOffice.data.office_id;
    await request(baseUrl, 'GET', `/api/v1/data/org/offices/${officeId}`, { token });
    await request(baseUrl, 'PATCH', `/api/v1/data/org/offices/${officeId}`, {
      token,
      body: { city: 'Addis Ababa Test' }
    });

    await request(baseUrl, 'POST', '/api/v1/workflows/payroll/calculate', {
      token,
      body: {
        gross_salary: 15000,
        taxable_adjustments: 1000,
        non_taxable_adjustments: 500,
        deductions: 250
      }
    });

    await request(baseUrl, 'DELETE', `/api/v1/data/org/offices/${officeId}`, { token });

    console.log(`Smoke test passed against ${baseUrl}`);
  } finally {
    await closeServer();
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
