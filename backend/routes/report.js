const express = require("express");
const pool = require("../config/database");
const { authenticateToken, requireManager } = require("../middleware/auth");

const router = express.Router();

router.get("/daily-summary", authenticateToken, requireManager, async (req, res) => {
    try {
        const { date, employee_id } = req.query;

        // Validate date
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing date (YYYY-MM-DD required)",
            });
        }

        let query = `
      SELECT 
        u.id AS employee_id,
        u.name AS employee_name,
        COUNT(ch.id) AS total_checkins,
        COUNT(DISTINCT ch.client_id) AS clients_visited,
        ROUND(
          IFNULL(
            SUM(
              (julianday(IFNULL(ch.checkout_time, ch.checkin_time)) - julianday(ch.checkin_time)) * 24 * 60
            ),
            0
          ),
          2
        ) AS minutes_worked
      FROM users u
      LEFT JOIN checkins ch
        ON u.id = ch.employee_id
      WHERE u.manager_id = ?
        AND (ch.checkin_time IS NULL OR DATE(ch.checkin_time) = ?)
    `;

        const params = [req.user.id, date];

        if (employee_id) {
            query += " AND u.id = ?";
            params.push(employee_id);
        }

        query += " GROUP BY u.id ORDER BY u.name";

        const [rows] = await pool.execute(query, params);

        const teamStats = rows.reduce(
            (acc, e) => {
                acc.total_employees += 1;
                acc.total_checkins += e.total_checkins;
                acc.total_minutes += e.minutes_worked;
                acc.total_clients += e.clients_visited;
                return acc;
            },
            {
                total_employees: 0,
                total_checkins: 0,
                total_minutes: 0,
                total_clients: 0,
            }
        );

        res.json({
            success: true,
            data: {
                date,
                employees: rows,
                team_stats: teamStats,
            },
        });
    } catch (error) {
        console.error("Daily summary error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate report",
        });
    }
});

module.exports = router;