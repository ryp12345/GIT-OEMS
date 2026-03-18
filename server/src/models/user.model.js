const pool = require('../config/db');

module.exports = {
  findByUsername: async (username) => {
    const res = await pool.query('SELECT * FROM departments WHERE username = $1 LIMIT 1', [username]);
    return res.rows[0] || null;
  },
  findById: async (deptid) => {
    const res = await pool.query('SELECT * FROM departments WHERE deptid = $1 LIMIT 1', [deptid]);
    return res.rows[0] || null;
  },
  updatePasswordById: async (deptid, passwordHash) => {
    const res = await pool.query(
      'UPDATE departments SET password = $1, datestmp = CURRENT_TIMESTAMP WHERE deptid = $2 RETURNING deptid',
      [passwordHash, deptid]
    );
    return res.rows[0] || null;
  }
};
