## 1. If this app had 10,000 employees checking in simultaneously, what would break first? How would you fix it?

The first thing that would break is the **database write path**, not the frontend or authentication.

In the current system, every check-in involves multiple database operations:

- Checking if an active check-in already exists
- Inserting a new check-in record
- Updating checkout data later

When 10,000 employees check in around the same time (for example, at the start of a workday), this creates a sudden spike of concurrent **write operations**.

The application currently uses SQLite, which allows only **one write at a time** due to database-level locking. Even if the API servers scale horizontally, SQLite becomes a bottleneck because all writes are serialized. Requests will queue up, latency will increase, and eventually timeouts or failures will occur.

### How I would fix it

1. **Move from SQLite to PostgreSQL**
   PostgreSQL supports concurrent writes using row-level locking and MVCC (Multi-Version Concurrency Control). This allows thousands of users to write simultaneously without blocking each other.

2. **Add proper indexing**
   Indexes on `(employee_id, status)` and `checkin_time` reduce lookup time and prevent full table scans during peak traffic.

3. **Enforce constraints at the database level**

   ```sql
   CREATE UNIQUE INDEX one_active_checkin
   ON checkins(employee_id)
   WHERE status = 'checked_in';
   ```

   This guarantees that an employee can never have more than one active check-in, even under heavy concurrency.

4. **Wrap check-in logic in a transaction**
   Using transactions ensures the read-check-insert flow is atomic and safe from race conditions.
   These changes shift correctness and scalability from application logic into the database, which is where it belongs.

## 2. What is the security issue in the current JWT implementation, and how would you improve it?

The main security issue is that the JWT payload includes the **password hash**.

Even though the password is hashed, this is still dangerous because **JWTs are only Base64 encoded, not encrypted**. Anyone who obtains the token (via XSS, logs, browser storage, or network leaks) can decode it and extract the hash.

Exposing password hashes increases the attack surface and enables **offline brute-force attacks** if tokens are compromised. Authentication data should never be treated as portable client-side state.

### Fix Applied

The issue was fixed by **removing the password hash from the JWT payload**.

JWTs now contain only identity and authorization data:

```json
{
  "id": 2,
  "email": "rahul@unolo.com",
  "role": "employee",
  "name": "Rahul Kumar",
  "iat": 1769531247,
  "exp": 1769617647
}
```

- **Passwords, hashes, and secrets remain server-side only**  
  Even hashed passwords must never be included in JWTs, since tokens are Base64-encoded and can be decoded by anyone who possesses them.

- **This prevents credential leakage**  
  Removing the password field eliminates the risk of:
  - Password hash exposure
  - Offline brute-force attacks
  - Account compromise if a token is leaked

### Further Improvements (Not Yet Implemented)

The following security enhancements can be added to further harden the system:

- **Short-lived access tokens**  
  Reduce token expiration to 10–15 minutes to limit damage from token theft.

- **Refresh tokens**
  - Stored in **httpOnly cookies**
  - Not accessible via JavaScript
  - Used only to issue new access tokens

- **Standard JWT claims**
  - `iss` (issuer)
  - `aud` (audience)
  - `iat` (issued at)
  - `exp` (expiration)

- **Periodic JWT secret rotation**  
  Ensures compromised signing keys do not remain valid indefinitely.

This fix addresses the immediate vulnerability, while the listed improvements provide a clear path to stronger, production-grade authentication.

## 3. How would you implement offline check-in support?

Offline check-in is an **event-based problem**, not a request-based one.

### Frontend / Mobile App

When the employee is offline:

- Store the check-in event locally (IndexedDB / AsyncStorage)
- Mark the event as `synced: false`
- Show immediate feedback such as **“Checked in (offline)”**

Example stored event:

```json
{
  "type": "checkin",
  "timestamp": "2026-01-28T09:10:00Z",
  "lat": 12.97,
  "lng": 77.59,
  "synced": false
}
```

When connectivity returns:

- Sync queued events in chronological order
- Send events to the server one by one
- Mark events as `synced: true` only after server confirmation
- Retry or flag conflicts if the server rejects an event

### Backend

- Accept client timestamps
- Validate timestamps:
  - No future-dated check-ins
  - No overlapping or duplicate check-ins
- Store both timestamps for auditing:
  - `client_checkin_time`
  - `server_received_time`

This approach enables reliable offline check-ins while preserving data integrity, auditability, and protection against time-based fraud.

## 4. SQL vs NoSQL — Which is Better for This System?

Choosing between SQL and NoSQL depends on the nature of the data and the operations the system needs to perform. For this Field Force Tracker application, the data is highly relational. There are employees, managers, clients, check-ins, and reports, all connected in a structured way. Many of the queries involve relationships, aggregations, and constraints—such as calculating total hours per employee, fetching check-ins for a specific date range, or determining which employees report to a given manager.

SQL databases are well-suited for these scenarios because they provide a structured schema, strong consistency, and support for transactions and complex queries using JOINs and aggregations. In contrast, NoSQL databases offer a flexible schema and easier horizontal scaling but rely on eventual consistency and have limited support for relational queries. While NoSQL is great for unstructured or rapidly changing data, it complicates reporting, enforcing constraints, and maintaining consistency in a system like this.

### Why SQL Fits This Application

- **Relational Data Management:** Employees, managers, check-ins, clients, and reports are naturally relational. SQL makes modeling these relationships straightforward.
- **Complex Queries:** Calculating total hours, fetching check-ins over a date range, and generating reports require JOINs and aggregations, which SQL handles efficiently.
- **Data Integrity:** SQL supports transactions and enforces constraints, ensuring that check-ins, assignments, and relationships remain consistent even under high concurrency.

### Recommendation

PostgreSQL is the best choice for this system because:

- It handles **high write concurrency**, which is important when many employees check in simultaneously.
- It supports **complex queries and reporting**, making it easy to generate accurate insights from the data.
- It **enforces constraints safely at scale**, preventing invalid or duplicate check-ins and maintaining overall data integrity.

Using a NoSQL database in this case would add unnecessary complexity without providing meaningful benefits for reporting, consistency, or enforcing business rules.

## 5. What is the difference between authentication and authorization? Identify where each is implemented in this codebase.

### Authentication vs Authorization

Authentication and Authorization are two closely related but distinct processes that work together to secure a system. While authentication focuses on **verifying who a user is**, authorization determines **what that user is allowed to do**. Authentication always happens first, followed by authorization.

### How Authentication Works

Authentication is the process of confirming the identity of a user or system. This is usually done by validating credentials such as passwords, OTPs, or biometrics.

**Process:**

1. The user provides credentials (like a password or fingerprint)
2. The system checks these credentials against stored records
3. If valid, the system recognizes the user as authenticated

**In our codebase:**

- `/login` checks the user’s credentials
- JWTs are generated for authenticated users
- `auth.js` middleware validates the token on protected routes

### How Authorization Works

Authorization decides what an authenticated user can access or perform within the system. It ensures that users only interact with resources and actions they are permitted to use.

**Process:**

1. The system checks the user’s role or permissions
2. Access to certain routes or actions is allowed or denied
3. Only authorized actions are executed

**In our codebase:**

- Role checks like `req.user.role === "manager"`
- Different endpoints for managers vs employees
- Previously, a check using `user.id === 1` caused authorization issues; switching to role-based checks fixed this

### Key Differences

| Authentication                                    | Authorization                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| Confirms the user’s identity                      | Determines the user’s permissions                                 |
| Happens first                                     | Happens after authentication                                      |
| Relies on credentials (password, OTP, biometrics) | Relies on roles, access levels, or privileges                     |
| Verifies if the user is valid                     | Determines what the valid user can do                             |
| User can change credentials                       | Permissions are controlled by the system                          |
| Visible to the user (e.g., login screen)          | Not visible to the user                                           |
| Examples: Passwords, OTPs, fingerprints           | Examples: Admin rights, read/write access, role-based permissions |

**Reference:**  
Concepts summarized and adapted from [GeeksforGeeks](https://www.geeksforgeeks.org/computer-networks/difference-between-authentication-and-authorization/)

## 6. What is a race condition? Are there any here?

A **race condition** is a type of bug that happens when two or more operations occur at nearly the same time and access the same shared resource without proper coordination. The result of those operations can vary depending purely on the order and timing in which they run. In other words, the system’s behavior becomes unpredictable because concurrent activities “race” each other to read or write shared state.

### Example in this system

In the Field Force Tracker, the check-in flow has a classic race scenario:

- Two check-in requests arrive for the same employee at almost the same time
- Both requests check if there’s an active check-in
- Both see that none exists
- Both insert a new check-in record

**Result:** The employee ends up with **two active check-ins**, violating the business rule that only one active check-in should exist at a time.

This kind of issue arises from concurrent access to shared state (the employee’s check-in status) without proper synchronization or protection. :contentReference[oaicite:1]{index=1}

Possible real-world triggers include:

- Accidental double-clicks
- Network retries sending duplicate requests
- The same user logged in from multiple devices
- Delays or slow responses from the database

### How to prevent it

The correct fix is to rely on **database-enforced constraints** rather than just application logic or frontend checks. By encoding the business rule into the database itself, we ensure correctness even under high concurrency.

For example, enforcing at most one active check-in per employee:

```sql
CREATE UNIQUE INDEX one_active_checkin
ON checkins(employee_id)
WHERE status = 'checked_in';
```

**Reference:**  
Concepts summarized and adapted from [GeeksforGeeks](https://www.geeksforgeeks.org/operating-systems/race-condition-vulnerability/)
