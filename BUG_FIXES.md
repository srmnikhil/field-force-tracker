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
