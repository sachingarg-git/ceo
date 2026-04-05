const express = require('express');
const router = express.Router();
const { query } = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await query(
      `SELECT u.ID, u.Username, u.FullName, u.Email, u.IsActive, r.RoleName, r.Permissions, r.ID as RoleID
       FROM Users u LEFT JOIN Roles r ON u.RoleID = r.ID
       WHERE u.Username = @username AND u.Password = @password`,
      { username, password }
    );
    if (result.recordset.length === 0) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }
    const user = result.recordset[0];
    if (!user.IsActive) {
      return res.json({ success: false, error: 'Account is disabled' });
    }
    // Update last login
    await query('UPDATE Users SET LastLogin = GETDATE() WHERE ID = @id', { id: user.ID });

    let permissions = [];
    try { permissions = JSON.parse(user.Permissions || '[]'); } catch {}

    res.json({
      success: true,
      user: {
        id: user.ID,
        username: user.Username,
        name: user.FullName,
        email: user.Email,
        role: user.RoleName,
        roleId: user.RoleID,
        permissions,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/users - list all users
router.get('/users', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.ID, u.Username, u.FullName, u.Email, u.IsActive, u.CreatedAt, u.LastLogin,
              r.RoleName, r.ID as RoleID
       FROM Users u LEFT JOIN Roles r ON u.RoleID = r.ID ORDER BY u.ID ASC`
    );
    res.json({ success: true, users: result.recordset.map(u => ({
      id: u.ID, username: u.Username, fullName: u.FullName, email: u.Email || '',
      isActive: u.IsActive, role: u.RoleName, roleId: u.RoleID,
      createdAt: u.CreatedAt, lastLogin: u.LastLogin,
    }))});
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/users - create user
router.post('/users', async (req, res) => {
  try {
    const { username, password, fullName, email, roleId } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Username and password required' });

    const existing = await query('SELECT ID FROM Users WHERE Username = @username', { username });
    if (existing.recordset.length > 0) return res.json({ success: false, error: 'Username already exists' });

    const result = await query(
      `INSERT INTO Users (Username, Password, FullName, Email, RoleID)
       OUTPUT INSERTED.ID VALUES (@username, @password, @fullName, @email, @roleId)`,
      { username, password, fullName: fullName || '', email: email || '', roleId: roleId || 1 }
    );
    res.json({ success: true, id: result.recordset[0].ID, message: 'User created' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/auth/users/:id - update user
router.put('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const b = req.body;
    const sets = [];
    const params = { id };

    if (b.fullName !== undefined) { sets.push('FullName = @fullName'); params.fullName = b.fullName; }
    if (b.email !== undefined) { sets.push('Email = @email'); params.email = b.email; }
    if (b.roleId !== undefined) { sets.push('RoleID = @roleId'); params.roleId = b.roleId; }
    if (b.isActive !== undefined) { sets.push('IsActive = @isActive'); params.isActive = b.isActive ? 1 : 0; }
    if (b.password) { sets.push('Password = @password'); params.password = b.password; }

    if (sets.length > 0) {
      await query(`UPDATE Users SET ${sets.join(', ')} WHERE ID = @id`, params);
    }
    res.json({ success: true, message: 'User updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/auth/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await query('DELETE FROM Users WHERE ID = @id', { id });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/roles - list all roles
router.get('/roles', async (req, res) => {
  try {
    const result = await query('SELECT * FROM Roles ORDER BY ID ASC');
    res.json({ success: true, roles: result.recordset.map(r => {
      let permissions = [];
      try { permissions = JSON.parse(r.Permissions || '[]'); } catch {}
      return { id: r.ID, name: r.RoleName, description: r.Description || '', permissions, createdAt: r.CreatedAt };
    })});
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/roles - create role
router.post('/roles', async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    if (!name) return res.json({ success: false, error: 'Role name required' });

    const result = await query(
      `INSERT INTO Roles (RoleName, Description, Permissions) OUTPUT INSERTED.ID VALUES (@name, @desc, @perms)`,
      { name, desc: description || '', perms: JSON.stringify(permissions || []) }
    );
    res.json({ success: true, id: result.recordset[0].ID, message: 'Role created' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/auth/roles/:id - update role
router.put('/roles/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const b = req.body;
    const sets = [];
    const params = { id };

    if (b.name !== undefined) { sets.push('RoleName = @name'); params.name = b.name; }
    if (b.description !== undefined) { sets.push('Description = @desc'); params.desc = b.description; }
    if (b.permissions !== undefined) { sets.push('Permissions = @perms'); params.perms = JSON.stringify(b.permissions); }

    if (sets.length > 0) {
      await query(`UPDATE Roles SET ${sets.join(', ')} WHERE ID = @id`, params);
    }
    res.json({ success: true, message: 'Role updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/auth/roles/:id
router.delete('/roles/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await query('DELETE FROM Roles WHERE ID = @id', { id });
    res.json({ success: true, message: 'Role deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
