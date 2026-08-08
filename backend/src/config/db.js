const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Wrap query to support both callback and promise style
const originalQuery = pool.query.bind(pool);
pool.query = function (sql, values, callback) {
    if (typeof values === "function") {
        callback = values;
        values = undefined;
    }

    if (typeof callback === "function") {
        originalQuery(sql, values)
            .then(([rows]) => {
                callback(null, rows);
            })
            .catch((err) => {
                callback(err);
            });
        return pool;
    }

    return originalQuery(sql, values);
};

module.exports = pool;