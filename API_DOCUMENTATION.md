## Reports API

### Daily Summary Report

Returns a date-wise summary of employee activity for a manager’s team.  
This endpoint is **manager-only** and supports optional employee-level filtering.

#### Endpoint

`GET /api/reports/daily-summary`

#### Access Control

- Requires authentication
- Requires `manager` role

#### Query Parameters

| Parameter     | Type   | Required | Description                           |
| ------------- | ------ | -------- | ------------------------------------- |
| `date`        | string | ✅ Yes   | Date in `YYYY-MM-DD` format           |
| `employee_id` | number | ❌ No    | Filter report for a specific employee |

If `employee_id` is not provided, the report includes **all employees under the manager**.

---

### Example Requests

**Team-wide daily summary**

`GET /api/reports/daily-summary?date=2026-01-27`

**Single employee daily summary**

`GET /api/reports/daily-summary?date=2026-01-27&employee_id=2`

---

### Successful Response (With Data)

#### Without employee_id

```json
{
  "success": true,
  "data": {
    "date": "2026-01-27",
    "employees": [
      {
        "employee_id": 3,
        "employee_name": "Priya Singh",
        "total_checkins": 1,
        "clients_visited": 1,
        "minutes_worked": 0.08
      },
      {
        "employee_id": 2,
        "employee_name": "Rahul Kumar",
        "total_checkins": 3,
        "clients_visited": 1,
        "minutes_worked": 186.25
      },
      {
        "employee_id": 4,
        "employee_name": "Vikram Patel",
        "total_checkins": 7,
        "clients_visited": 2,
        "minutes_worked": 25.25
      }
    ],
    "team_stats": {
      "total_employees": 3,
      "total_checkins": 11,
      "total_minutes": 211.58,
      "total_clients": 4
    }
  }
}
```

#### With employee_id

```json
{
  "success": true,
  "data": {
    "date": "2026-01-27",
    "employees": [
      {
        "employee_id": 2,
        "employee_name": "Rahul Kumar",
        "total_checkins": 3,
        "clients_visited": 1,
        "minutes_worked": 186.25
      }
    ],
    "team_stats": {
      "total_employees": 1,
      "total_checkins": 3,
      "total_minutes": 186.25,
      "total_clients": 1
    }
  }
}
```

### Successful Response (No Check-ins for the Date)

When employees exist but no one checked in on the given date, the API still returns a valid response with zeroed metrics.

```json
{
  "success": true,
  "data": {
    "date": "2026-01-28",
    "employees": [],
    "team_stats": {
      "total_employees": 0,
      "total_checkins": 0,
      "total_minutes": 0,
      "total_clients": 0
    }
  }
}
```

This behavior ensures:

- Consistent API shape
- No frontend conditionals for “no data” states
- Predictable reporting even on non-working days

### Error Responses

#### Invalid or missing date

```json
{
  "success": false,
  "message": "Invalid or missing date (YYYY-MM-DD required)"
}
```

#### Unauthorized access

```json
{
  "success": false,
  "message": "Unauthorized"
}
```
