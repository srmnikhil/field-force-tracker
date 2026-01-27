# Bug Fixes & Debugging Notes

## Bug #1 — Employee Dashboard crashes with SQLite syntax error

### Location

**File:** `starter-code/backend/routes/dashboard.js`  
**Line:** ~80 (inside `/dashboard/employee` route, weekStats query)

---

### What was wrong

The query used **MySQL date syntax** even though the project uses **SQLite**.

This part is invalid in SQLite:

```sql
DATE_SUB(NOW(), INTERVAL 7 DAY)
```

---

### How it was fixed

The query was changed to use SQLite date syntax:

```sql
DATE('now','-7 days')
```

---

### Why this fix is correct

SQLite performs date arithmetic using string-based modifiers such as '-7 days'.

The expression date('now', '-7 days') correctly returns the date from seven days ago, allowing SQLite to filter records from the last week.

## Bug #2 — Checkin form submission issue

### Location

**File:** `starter-code/frontend/src/pages/CheckIn.jsx`  
**Line:** ~59 (inside `function handleCheckIn()` Form Submission)

---

### What was wrong

The check-in form submission handler did not call `preventDefault()` on the submit event.

Because of this, the browser performed its default form submission behavior, which caused the page to reload when the form was submitted. This interrupted the API request and made the check-in process unreliable.

---

### How it was fixed

#### Before:

```js
  const handleCheckIn = async (e) => {
        setError('');
        setSuccess('');
    ...}
```

#### After:

```js
  const handleCheckIn = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
    ...}
```

---

### Why this fix is correct

In React, form submissions must prevent the browser’s default behavior to allow JavaScript to handle the request.

Calling e.preventDefault() stops the page from reloading and ensures the API call completes correctly, making the check-in process reliable and predictable.

## Bug #3 — SQLite string literal syntax error in check-in status queries

### Location

**File:** `starter-code/backend/routes/checkin.js`

**Lines:**  
~45 (active check-in query)  
~88 (checkout update query)

---

### What was wrong

The SQL queries used **double quotes** for string values:

```sql
'SELECT * FROM checkins WHERE employee_id = ? AND status = "checked_in"'
'UPDATE checkins SET checkout_time = NOW(), status = "checked_out" WHERE id = ?',
```

In SQLite, double quotes refer to column names, not string values.
SQLite therefore tried to find columns named checked_in and checked_out, which do not exist.

This caused errors such as:

```
SqliteError: no such column: checked_in
SqliteError: no such column: checked_out
```

---

### How it was fixed

The string values were changed to use single quotes, which SQLite uses for string literals.

#### Before:

```sql
'SELECT * FROM checkins WHERE employee_id = ? AND status = "checked_in"'
'UPDATE checkins SET checkout_time = NOW(), status = "checked_out" WHERE id = ?',
```

#### After:

```sql
"SELECT * FROM checkins WHERE employee_id = ? AND status = 'checked_in'"
"UPDATE checkins SET checkout_time = NOW(), status = 'checked_out' WHERE id = ?",
```

---

### Why this fix is correct

SQLite uses single quotes (') for string literals and double quotes (") for identifiers (such as column names).
Using single quotes ensures SQLite correctly interprets 'checked_in' and 'checked_out' as text values.

## Bug #4 — Invalid MySQL date function used in SQLite

### Location

**File:** `starter-code/backend/routes/checkin.js`

**Line:**  
~88 (checkout update query)

---

### What was wrong

The query used the MySQL function:

```sql
NOW()
```

SQLite does not support NOW(), causing the checkout operation to fail.

---

### How it was fixed

The MySQL function was replaced with the SQLite-compatible function:

```sql
datetime('now')
```

#### Before

```sql
checkout_time = NOW()
```

#### After

```sql
checkout_time = datetime('now')
```

---

### Why this fix is correct

SQLite uses the datetime('now') function to get the current date and time, which is compatible with the SQLite database.

## Bug #5 — Attendance history page crashes on load

### Location

**File:** `starter-code/frontend/src/pages/History.jsx`

**Line:** ~6 (state initialization) and ~44 (totalHours calculation)

---

### What was wrong

The `checkins` state was initialized as `null`, but later treated as an array.

```js
const [checkins, setCheckins] = useState(null);
```

Later in the component, the code attempted to call .reduce() on checkins:

```js
const totalHours = checkins.reduce(...)
```

On the first render, before the API response arrived, checkins was still null, causing the page to crash because null does not have a reduce method.

### How it was fixed

The state was initialized as an empty array instead of null so that array operations can safely run before data is loaded.

#### Before:

```js
const [checkins, setCheckins] = useState(null);
```

#### After:

```js
const [checkins, setCheckins] = useState([]);
```

Additionally, the reducer was made defensive to ignore invalid entries:

```js
const totalHours = checkins.reduce((total, checkin) => {
  if (!checkin || !checkin.checkout_time || !checkin.checkin_time) {
    return total;
  }

  const checkinTime = new Date(checkin.checkin_time);
  const checkoutTime = new Date(checkin.checkout_time);

  const hours = (checkoutTime - checkinTime) / (1000 * 60 * 60);
  return total + hours;
}, 0);
```

---

### Why this fix is correct

Initializing the state as an empty array allows the component to safely perform array operations before data is loaded, preventing runtime errors and ensuring the page loads correctly.

## Bug #6 — Check-in & Check-out times displayed in UTC instead of user’s local time

### Location

**File:** `starter-code/frontend/src/pages/History.jsx`, `starter-code/frontend/src/pages/Dashboard.jsx`

**Line:** ~162 (checkin time display) and ~164 (checkout time display) `starter-code/frontend/src/pages/History.jsx`

**Line:** ~60 (checkin time display) `starter-code/frontend/src/pages/Dashboard.jsx`


### What was wrong

The application displayed check-in and checkout times using:

```js
new Date(checkin.checkin_time).toLocaleTimeString();
```

The time values were stored in UTC but without any timezone marker, for example:
`2024-01-15 09:15:00`

Because this format does not include timezone information, JavaScript interpreted it as the user’s local time instead of UTC.
This caused all displayed times to be incorrect by the user’s timezone offset (for example, 5.5 hours in India).

### How it was fixed

The date parsing and formatting logic was centralized into reusable utility functions that correctly interpret stored UTC values and convert them to the user’s local timezone.

A new parser was added:

```js
export function parseUtcToLocal(utcString) {
  if (!utcString) return null;

  const iso = utcString.replace(" ", "T") + "Z";
  return new Date(iso);
}
```

And reusable formatting helpers were added:

```js
export function formatLocalDate(date) {
  if (!date) return "-";
  return date.toLocaleDateString();
}

export function formatLocalTime(date) {
  if (!date) return "-";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

### Why this fix is correct

The stored timestamps represent UTC values but do not include an explicit timezone indicator.
By appending the Z (UTC) marker before creating the Date object, JavaScript correctly interprets the time as UTC and converts it to the user’s device timezone.

Separating parsing and formatting also ensures consistent, accurate date and time rendering across the entire application.

## Bug #7 — Invalid date filters and incorrect refetch behavior on History page

### Location

**File:** `starter-code/frontend/src/pages/History.jsx`

**Lines:** ~78–113 (date inputs, filter and clear logic)

---

### What was wrong

The History page had multiple issues in its date filtering logic:

1. **End date could be set in the future**, allowing users to request data that could not exist.
2. **End date could be earlier than the start date**, producing invalid or empty queries.
3. Clicking **Clear** always triggered a refetch, even when only one date was selected.
4. When clearing a full date range, the API request was still sent with the old filter values because React state updates are asynchronous, causing the UI to show stale filtered results instead of all records.

This led to incorrect filtering, flickering UI, and confusing results.

---

### How it was fixed

Input constraints were added to prevent invalid date selections:

```jsx
<input type="date" max={todayUTC} />
<input type="date" min={startDate || ""} max={todayUTC} />
```

Filtering was restricted so that it only runs when both start and end dates are selected:

```js
if (!startDate || !endDate) {
  alert("Please select both start and end date");
  return;
}
```

The Clear button logic was corrected so it only refetches when a full filter was previously applied, and it fetches unfiltered data directly instead of using stale state:

```js
const hadFullFilter = startDate && endDate;
setStartDate("");
setEndDate("");

if (!hadFullFilter) return;

api.get("/checkin/history").then(...)
```

### Why this fix is correct

The UI now enforces valid date ranges at the input level, preventing impossible or misleading queries.

Filtering only occurs when a complete date range is provided, eliminating partial or ambiguous searches.

The Clear button no longer triggers stale filtered requests because it bypasses state-dependent query building and explicitly requests the unfiltered history, ensuring the UI always matches the actual data.
