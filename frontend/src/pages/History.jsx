import { useState, useEffect } from "react";
import api from "../utils/api";
import {
  formatDuration,
  formatLocalDate,
  formatLocalTime,
  getTodayUTC,
  parseUtcToLocal,
} from "../utils/date-helper";
import { formatDistance } from "../utils/calculateDistance";

function History({ user }) {
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      let url = "/checkin/history";
      const params = new URLSearchParams();

      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      if (params.toString()) {
        url += "?" + params.toString();
      }

      const response = await api.get(url);

      if (response.data.success) {
        setCheckins(response.data.data);
      }
    } catch (err) {
      setError("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (e) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      alert("Please select both start and end date");
      return;
    }

    setLoading(true);
    fetchHistory();
  };

  const todayUTC = getTodayUTC();

  const totalHours = checkins.reduce((total, checkin) => {
    if (checkin.checkout_time) {
      const checkinTime = new Date(checkin.checkin_time);
      const checkoutTime = new Date(checkin.checkout_time);
      const hours = (checkoutTime - checkinTime) / (1000 * 60 * 60);
      return total + hours;
    }
    return total;
  }, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Check-in History</h2>

      {/* Filter Form */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <form
          onSubmit={handleFilter}
          className="flex flex-wrap gap-4 items-end"
        >
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              max={todayUTC}
              onChange={(e) => {
                setStartDate(e.target.value);

                // If endDate is before new startDate, reset it
                if (endDate && e.target.value > endDate) {
                  setEndDate("");
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              min={startDate || ""}
              max={todayUTC}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Filter
          </button>
          <button
            type="button"
            onClick={() => {
              const hadFullFilter = startDate && endDate;

              setStartDate("");
              setEndDate("");

              if (!hadFullFilter) return;

              // Fetch unfiltered history
              setLoading(true);
              setLoading(true);
              api
                .get("/checkin/history")
                .then((res) => {
                  if (res.data.success) {
                    setCheckins(res.data.data);
                  }
                })
                .catch(() => setError("Failed to load history"))
                .finally(() => setLoading(false));
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Clear
          </button>
        </form>
      </div>

      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-8">
          <div>
            <p className="text-sm text-gray-500">Total Check-ins</p>
            <p className="text-2xl font-bold text-blue-600">
              {checkins?.length || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Hours Worked</p>
            <p className="text-2xl font-bold text-green-600">
              {totalHours.toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {checkins?.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Check-in
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Check-out
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Distance from client
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {checkins.map((checkin) => {
                const checkinTime = parseUtcToLocal(checkin.checkin_time);
                const checkoutTime = checkin.checkout_time
                  ? parseUtcToLocal(checkin.checkout_time)
                  : null;
                const duration = formatDuration(checkinTime, checkoutTime);
                const distance = checkin.distance_from_client
                  ? formatDistance(checkin.distance_from_client)
                  : "-";

                return (
                  <tr key={checkin.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {formatLocalDate(checkinTime)}
                    </td>
                    <td className="px-4 py-3">
                      <div>{checkin.client_name}</div>
                      <div className="text-xs text-gray-500">
                        {checkin.client_address}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {formatLocalTime(checkinTime)}
                    </td>
                    <td className="px-4 py-3">
                      {checkoutTime ? formatLocalTime(checkoutTime) : "-"}
                    </td>
                    <td className="px-4 py-3">{distance}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          duration === "Active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {duration}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {checkin.notes || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No check-in history found
          </div>
        )}
      </div>
    </div>
  );
}

export default History;
