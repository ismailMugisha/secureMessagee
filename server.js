const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());

// PostgreSQL connection using connection string
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_mJhLtdy7wH0a@ep-polished-fog-a8bugzp7-pooler.eastus2.azure.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

// ----------- Contacts CRUD ------------

// GET all contacts
app.get('/api/contacts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET single contact by id
app.get('/api/contacts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query('SELECT * FROM contacts WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST add new contact
app.post('/api/contacts', async (req, res) => {
  try {
    const { name, phone, role } = req.body;
    if (!name || !phone || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const result = await pool.query(
      'INSERT INTO contacts (name, phone, role) VALUES ($1, $2, $3) RETURNING *',
      [name, phone, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update contact by id
app.put('/api/contacts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, role } = req.body;
    if (!name || !phone || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const result = await pool.query(
      'UPDATE contacts SET name = $1, phone = $2, role = $3 WHERE id = $4 RETURNING *',
      [name, phone, role, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE contact by id
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query('DELETE FROM contacts WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    res.json({ message: 'Contact deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------ Messages (send to role with GPS) ------------

// Note: Make sure your `messages` table has columns:
// sender (text), receiver (text), content (text), timestamp (timestamp), latitude (text), longitude (text)

app.post('/api/messages/send-to-role', async (req, res) => {
  const { sender, role, content, latitude, longitude } = req.body;

  if (!sender || !role || !content) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Find all contacts with the given role
    const receiversResult = await pool.query('SELECT name FROM contacts WHERE role = $1', [role]);

    if (receiversResult.rows.length === 0) {
      return res.status(404).json({ message: 'No contacts found with this role' });
    }

    const now = new Date().toISOString();

    // Build bulk insert query for messages
    const values = receiversResult.rows.map(r =>
      `('${sender}', '${r.name}', '${content}', '${now}', '${latitude || ''}', '${longitude || ''}')`
    ).join(',');

    const insertQuery = `
      INSERT INTO messages (sender, receiver, content, timestamp, latitude, longitude)
      VALUES ${values}
    `;

    await pool.query(insertQuery);

    res.status(200).json({ message: `Message sent to all ${role}s successfully.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
