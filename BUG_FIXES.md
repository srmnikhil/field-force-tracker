# Bug Fixes & Debugging Notes

## Bug #1 — Password verification always succeeded

### Location

**File:** `starter-code/backend/routes/auth.js`

**Line:** ~28 (password comparison)

---

### What was wrong

The password was checked using:

```js
const isValidPassword = bcrypt.compare(password, user.password);
```

`bcrypt.compare()` returns a Promise.
Because it was not awaited, isValidPassword was always truthy, allowing incorrect passwords to pass validation.

This caused:

- Logins to succeed even with wrong passwords
- Authentication to be unreliable

### How I verified it

I attempted to log in with an incorrect password.
Instead of showing “Invalid credentials”, it redirected me to directly on Dashboard.

### How it was fixed

The Promise is now awaited:

```js
const isValidPassword = await bcrypt.compare(password, user.password);
```

### Why this fix is correct

`bcrypt.compare()` performs an asynchronous hash comparison.
Awaiting it ensures the actual boolean result is used.

This restores proper authentication:

- Correct passwords succeed
- Incorrect passwords fail

## Bug #2 — Password hash was exposed inside JWT token

### Location

**File:** `starter-code/backend/routes/auth.js`

**Line:** ~34 (JWT creation)

---

### What was wrong

The JWT was generated using:

```js
jwt.sign(
  {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    password: user.password,
  },
  process.env.JWT_SECRET,
  { expiresIn: "24h" },
);
```

This included the bcrypt password hash inside the token payload.

JWTs are Base64-encoded, not encrypted.
Anyone who receives the token can decode it.

I verified this by copying the token returned by /login and pasting it into https://jwt.io
, which revealed the password hash in the payload.

This exposed:

```js
{
  "id": 2,
  "email": "rahul@unolo.com",
  "role": "employee",
  "name": "Rahul Kumar",
  "password": "$2b$10$qz3kBSMGWMhV41bdbgt5FuzDxdhWkz5gtOexZSw9GZn28BRx6Ba5O",
  "iat": 1769531247,
  "exp": 1769617647
}
```

### How it was fixed

The password field was removed from the JWT payload:

```js
jwt.sign(
  { id: user.id, email: user.email, role: user.role, name: user.name },
  process.env.JWT_SECRET,
  { expiresIn: "24h" },
);
```

### Why this fix is correct

JWTs should contain only identity and authorization data.
Passwords (even hashed) must never be sent to clients.

Removing the password prevents:

- Hash leakage
- Offline cracking
- Account compromise from token theft

---

## Bug #3 — Login page was reloading on wrong credentials due to broken Axios auth interceptor

### Location

**File:** `starter-code/frontend/src/utils/api.js`

---

### What was wrong

The Axios response interceptor was written like this:

```js
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
```

This logic blindly redirected to /login on every 401 or 403 — including when the user was already on the login page.

When a user entered a wrong email or password:

- The backend correctly returned 401 Invalid credentials
- Axios intercepted it
- The interceptor forced a redirect to /login
- The page reloaded
- The error message was lost
- The user never saw why login failed
- This made it appear like the login form was broken or refreshing randomly.

### How I verified it

I attempted to log in with an incorrect password.
Instead of showing “Invalid credentials”, the page instantly refreshed and stayed on /login with no error message.

This confirmed the interceptor was hijacking authentication errors.

### How it was fixed

The interceptor was updated to avoid redirecting when the user is already on the login page:

```js
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (
      (status === 401 || status === 403) &&
      window.location.pathname !== "/login"
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);
```

### Why this fix is correct

`401` on the login page means wrong credentials, not “session expired”.

This fix ensures:

- Invalid login attempts show proper error messages
- Users are only logged out when their token is invalid
- The login page does not refresh and lose state
- Auth flow behaves like a real production system

Without this fix, every failed login was treated as a forced logout — which is logically wrong and breaks usability.

## Bug #4 — Incorrect HTTP status codes returned by API

### Location

**Files:**

- `starter-code/backend/routes/checkin.js`
- `starter-code/backend/middleware/auth.js`

**Lines:** The bug is in `checkin.js` around lines ~30 and ~50 in the validation and active check-in checks, and in `middleware/auth.js` around line ~15 in the authentication error handling.

---

### What was wrong

Several API endpoints were returning incorrect HTTP status codes for error scenarios.

Examples of incorrect behavior:

- Missing required input (such as `client_id`) returned `200 OK`
- Attempting to check in when an active check-in already existed returned `400 Bad Request`
- Invalid or expired JWT tokens returned `403 Forbidden`

These responses were incorrect because `200` indicates success and `403` is meant for authorization failures, not authentication errors. This caused the frontend to misinterpret failed requests as successful or to handle authentication failures incorrectly.

---

### How it was fixed

The affected API responses were updated to return the correct HTTP status codes.

#### Before

```js
return res
  .status(200)
  .json({ success: false, message: "Client ID is required" });

return res.status(400).json({
  success: false,
  message: "You already have an active check-in",
});

return res
  .status(403)
  .json({ success: false, message: "Invalid or expired token" });
```

#### After

```js
return res
  .status(400)
  .json({ success: false, message: "Client ID is required" });

return res.status(409).json({
  success: false,
  message: "You already have an active check-in",
});

return res
  .status(401)
  .json({ success: false, message: "Invalid or expired token" });
```

### Why this fix is correct

The correct HTTP status codes now accurately reflect the nature of the errors, allowing the frontend to handle them appropriately.

- `400 Bad Request` indicates that the client sent invalid data.
- `409 Conflict` is used for situations where the request cannot be processed due to a conflict, such as an active check-in.
- `401 Unauthorized` is the appropriate status for authentication failures, ensuring that the frontend can distinguish between authentication and authorization issues.

## Bug #5 — Dashboard shows incorrect data for some users

### Location

**File:** `starter-code/frontend/src/pages/Dashboard.jsx`  
**Line:** ~15

```js
const endpoint = user.id === 1 ? "/dashboard/stats" : "/dashboard/employee";
```

### What was wrong

The dashboard API endpoint was selected using a hard-coded user ID check (user.id === 1) to decide whether the logged-in user is a manager.

This incorrectly assumes that the manager will always have ID 1, which is unsafe and unreliable. As soon as:

- More users are added
- The database is reseeded
- Another manager is created
- Data order changes

the condition breaks.

Because of this:

- Some managers were sent to the employee dashboard API
- Some employees could be sent to the manager dashboard API
- Users saw incorrect or unauthorized dashboard data

### How it was fixed

The logic was changed to use the user’s role instead of a hard-coded ID:

```js
const endpoint =
  user.role === "manager" ? "/dashboard/stats" : "/dashboard/employee";
```

### Why this fix is correct

User IDs should never be used for authorization logic.  
Roles exist specifically to define permissions.

The backend already enforces access using role === "manager", so the frontend must match the same rule.

This guarantees:

- Correct API selection
- Accurate dashboard data
- No accidental exposure of manager data to employees

The fix makes the dashboard reliable, secure, and role-driven instead of relying on a fragile magic number.

## Bug #6 — SQLite string literal syntax error in check-in status queries

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

## Bug #7 — SQL Injection vulnerability in check-in history filter

### Location

**File:** `starter-code/backend/routes/checkin.js`

**Lines:** ~112–117 (inside `GET /checkin/history`)

---

### What was wrong

The check-in history API directly interpolated user-provided query parameters into the SQL string:

```js
if (start_date) {
  query += ` AND DATE(ch.checkin_time) >= '${start_date}'`;
}
if (end_date) {
  query += ` AND DATE(ch.checkin_time) <= '${end_date}'`;
}
```

Because start_date and end_date come from req.query, this allowed SQL injection.

A malicious user could send:

```
/checkin/history?start_date=2026-01-10' OR 1=1 --
```

Which turns the SQL into:

```sql
AND DATE(ch.checkin_time) >= '2026-01-10' OR 1=1 --'
```

This bypasses the date filter and returns all check-ins, including data outside the allowed range.

I personally verified this by sending that payload using Thunder Client and received the entire check-ins table in the response.
This is a critical security issue because it allows data leakage using only a crafted URL.

### How it was fixed

The query was rewritten to use parameterized placeholders instead of string interpolation.

```js
if (start_date) {
  query += ` AND DATE(ch.checkin_time) >= ?`;
  params.push(start_date);
}

if (end_date) {
  query += ` AND DATE(ch.checkin_time) <= ?`;
  params.push(end_date);
}
```

### Why this fix is correct

Prepared statements ensure that user input is treated strictly as data, not executable SQL.
Even if a malicious value like:

```
2026-01-10' OR 1=1 --

```

## Bug #8 — Checkin form submission issue

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

## Bug #9 — Invalid MySQL date function used in SQLite

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

## Bug #10 — Employee Dashboard crashes with SQLite syntax error

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

## Bug #11 — Attendance history page crashes on load

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

## Bug #12 — Check-in & Check-out times displayed in UTC instead of user’s local time

### Location

**File:**

- `starter-code/frontend/src/pages/History.jsx`
- `starter-code/frontend/src/pages/Dashboard.jsx`

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

## Bug #13 — Invalid date filters and incorrect refetch behavior on History page

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

## Bug #14 — Performance issues caused by unnecessary re-renders

### Location

**Files affected:**

- `starter-code/frontend/src/pages/CheckIn.jsx`
- `starter-code/frontend/src/pages/History.jsx`
- `starter-code/frontend/src/pages/Report.jsx`
- `starter-code/frontend/src/App.jsx`
- `starter-code/frontend/src/components/Layout.jsx`

---

### What was wrong

- Several components were re-rendering more often than required.
- Heavy computations such as distance calculation, time aggregation, and data formatting were executed on every render.
- Typing in form fields triggered recalculations unrelated to that input.
- Authentication state (`user`) was passed through multiple components using props.
- Any auth-related change caused the entire route tree to re-render unnecessarily.

---

### How it was fixed

- Expensive calculations were memoized so they only run when their actual data changes.
- Derived values such as totals and formatted rows were stabilized.
- Authentication state was no longer passed through props across routes and layout.
- Components now read authentication data directly from `AuthContext`.

---

### Why this fix is correct

- React should only recompute heavy logic when the data it depends on changes.
- Memoization prevents unnecessary recalculations during unrelated state updates.
- Using context directly avoids cascading re-renders caused by prop changes.
- This improves performance, navigation smoothness, and scalability as the app grows.
