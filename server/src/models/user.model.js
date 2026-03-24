const pool = require('../config/db');

module.exports = {
  findByUsername: async (username) => {
    const res = await pool.query('SELECT * FROM departments WHERE username = $1 LIMIT 1', [username]);
    if (!res.rows[0]) return null;
    // Ensure role is present, fallback to 'hod' if missing
    const user = res.rows[0];
    user.role = user.role || 'hod';
    return user;
  },
  findById: async (deptid) => {
    const res = await pool.query('SELECT * FROM departments WHERE deptid = $1 LIMIT 1', [deptid]);
    if (!res.rows[0]) return null;
    const user = res.rows[0];
    user.role = user.role || 'hod';
    return user;
  },
  updatePasswordById: async (deptid, passwordHash) => {
    const res = await pool.query(
      'UPDATE departments SET password = $1, datestmp = CURRENT_TIMESTAMP WHERE deptid = $2 RETURNING deptid',
      [passwordHash, deptid]
    );
    return res.rows[0] || null;
  }
};
