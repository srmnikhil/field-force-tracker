import { useEffect, useState } from "react";
import api from "../utils/api";
import { formatMinutes, getTodayUTC } from "../utils/date-helper";

function Reports({ user }) {
  const today = getTodayUTC();

  const [date, setDate] = useState(today);
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTeam();
    fetchReport(); // default load for today (all employees)
  }, []);

  const fetchTeam = async () => {
    const res = await api.get("/dashboard/stats");
    if (res.data.success) {
      setEmployees(res.data.data.team_members);
    }
  };

  const fetchReport = async () => {
    try {
      let url = "/reports/daily-summary";
      const params = new URLSearchParams();

      params.append("date", date); // date is required

      if (employeeId) {
        params.append("employee_id", employeeId);
      }

      if (params.toString()) {
        url += "?" + params.toString();
      }

      setLoading(true);
      setError("");

      const response = await api.get(url);

      if (response.data.success) {
        setReport(response.data.data);
      }
    } catch (err) {
      setError("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== "manager") {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Unauthorized access
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Daily Summary</h2>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-600">Date</label>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600">Employee</label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="border px-3 py-2 rounded"
          >
            <option value="">All Employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchReport}
          className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700"
        >
          View Report
        </button>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {report && report.employees.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-6 rounded text-center">
          No data available for {report.date}
        </div>
      )}

      {report && report.employees.length > 0 && (
        <>
          {/* Team cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Stat
              title="Employees Active"
              value={report.team_stats.total_employees}
            />
            <Stat
              title="Total Check-ins"
              value={report.team_stats.total_checkins}
            />
            <Stat
              title="Total Time Worked"
              value={formatMinutes(report.team_stats.total_minutes)}
            />
            <Stat
              title="Clients Visited"
              value={report.team_stats.total_clients}
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow">
            <table className="w-full">
              <thead className="bg-gray-50 text-sm text-gray-600">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-center">Check-ins</th>
                  <th className="p-3 text-center">Time Worked</th>
                  <th className="p-3 text-center">Clients</th>
                </tr>
              </thead>
              <tbody>
                {report.employees.map((e) => (
                  <tr key={e.employee_id} className="border-t">
                    <td className="p-3">{e.employee_name}</td>
                    <td className="p-3 text-center">{e.total_checkins}</td>
                    <td className="p-3 text-center">
                      {formatMinutes(e.minutes_worked)}
                    </td>
                    <td className="p-3 text-center">{e.clients_visited}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="bg-white p-5 rounded-lg shadow">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-blue-600">{value}</p>
    </div>
  );
}

export default Reports;
