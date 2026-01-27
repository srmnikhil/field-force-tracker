import { useState, useEffect, useMemo } from "react";
import api from "../utils/api";
import {
  formatDistance,
  getDistanceInMeters,
} from "../utils/calculateDistance";

function CheckIn() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState(null);
  const [activeCheckin, setActiveCheckin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchData();
    getCurrentLocation();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, activeRes] = await Promise.all([
        api.get("/checkin/clients"),
        api.get("/checkin/active"),
      ]);

      if (clientsRes.data.success) {
        setClients(clientsRes.data.data);
      }
      if (activeRes.data.success) {
        setActiveCheckin(activeRes.data.data);
      }
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (err) => {
          console.error("Location error:", err);
          // Set default location (Gurugram) for testing
          setLocation({ latitude: 28.4595, longitude: 77.0266 });
        },
      );
    }
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await api.post("/checkin", {
        client_id: selectedClient,
        latitude: location?.latitude,
        longitude: location?.longitude,
        distance_from_client: distanceMeters,
        notes: notes,
      });

      if (response.data.success) {
        setSuccess("Checked in successfully!");
        setSelectedClient("");
        setNotes("");
        fetchData();
        getCurrentLocation();
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await api.put("/checkin/checkout");

      if (response.data.success) {
        setSuccess("Checked out successfully!");
        fetchData();
        getCurrentLocation();
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedClientObj = useMemo(() => {
    if (!selectedClient) return null;
    return clients.find((c) => c.id === Number(selectedClient));
  }, [clients, selectedClient]);

  const distanceMeters = useMemo(() => {
    if (!location) return null;

    const employeeLat = location.latitude;
    const employeeLng = location.longitude;
    let targetLat, targetLng;

    if (activeCheckin) {
      targetLat = activeCheckin.client_lat;
      targetLng = activeCheckin.client_lng;
    } else if (selectedClientObj) {
      targetLat = selectedClientObj.latitude;
      targetLng = selectedClientObj.longitude;
    } else {
      return null;
    }

    return getDistanceInMeters(employeeLat, employeeLng, targetLat, targetLng);
  }, [location, activeCheckin, selectedClientObj]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Check In / Out</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {/* Current Location Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="font-semibold mb-2">Your Current Location</h3>
        {location ? (
          <p className="text-gray-600">
            Lat: {location.latitude.toFixed(6)}, Long:{" "}
            {location.longitude.toFixed(6)}
          </p>
        ) : (
          <p className="text-gray-500">Getting location...</p>
        )}
      </div>

      {/* Active Check-in Card */}
      {activeCheckin && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-800 mb-2">Active Check-in</h3>
          <p className="text-blue-700">
            You are currently checked in at{" "}
            <strong>{activeCheckin.client_name}</strong>
          </p>
          {(distanceMeters || activeCheckin?.distance_from_client) && (
            <div className="mb-4 p-4 rounded-md bg-gray-50 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Distance from client</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatDistance(
                      location
                        ? distanceMeters
                        : activeCheckin.distance_from_client,
                    )}
                  </p>

                  {(location
                    ? distanceMeters > 500
                    : activeCheckin.distance_from_client > 500) && (
                    <p className="text-red-500 text-sm mt-1">
                      You are far from the client location
                    </p>
                  )}
                </div>

                {!location && (
                  <button
                    onClick={getCurrentLocation}
                    className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Enable Real Time Distance Calculation
                  </button>
                )}
              </div>
            </div>
          )}

          <p className="text-sm text-blue-600 mt-1">
            Since: {new Date(activeCheckin.checkin_time).toLocaleString()}
          </p>
          <button
            onClick={handleCheckOut}
            disabled={submitting}
            className="mt-4 bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 disabled:bg-red-400"
          >
            {submitting ? "Processing..." : "Check Out"}
          </button>
        </div>
      )}

      {/* Check-in Form */}
      {!activeCheckin && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">New Check-in</h3>

          <form onSubmit={handleCheckIn}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Select Client
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Choose a client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} - {client.address}
                  </option>
                ))}
              </select>
            </div>
            {selectedClient && location && (
              <div className="mb-4 p-3 rounded-md bg-gray-50 border">
                <p className="text-sm">
                  Distance from client:{" "}
                  <strong>{formatDistance(distanceMeters)}</strong>
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="Add any notes about this visit..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedClient || !location}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-400"
            >
              {submitting ? "Checking in..." : "Check In"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default CheckIn;
