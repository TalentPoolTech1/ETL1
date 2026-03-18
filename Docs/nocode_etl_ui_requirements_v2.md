
# NoCode ETL UI Requirements (Extended)

---

# Executions & Scheduling

## Objective
Provide full observability and control over pipeline and orchestrator executions.

---

## Execution Tab

Each Pipeline and Orchestrator must have:

- Executions
- Logs
- Metrics
- Code / SQL
- Alerts

---

## Executions Grid

Must include:

- Execution ID
- Execution Name
- Object Name
- Status
- Start Time
- End Time
- Duration
- Run By
- Trigger Type
- Rows Processed
- Rows Output
- Rows Failed
- Data Volume
- Environment
- Version Used
- Retry Count

---

## Filtering

- Date range
- Time range
- Status
- User
- Trigger type
- Duration
- Rows

---

## Execution Details

Click execution → open new tab with:

- Summary
- Steps
- Logs
- Code
- Metrics

---

## Logs

- Timestamp
- Level
- Message
- Search
- Download

---

## Code

- Generated SQL
- Execution plan
- Copy support

---

## Metrics

- Duration
- Throughput
- Step breakdown

---

## Scheduling

### Types
- Cron
- Interval
- Event
- Manual

### Properties
- Name
- Enabled toggle
- Timezone
- Retry policy
- Failure handling

---

## Status Icons

- Running
- Success
- Warning
- Failed
- Waiting
- Cancelled

---

## Acceptance Criteria

1. Execution tab exists
2. Filtering works
3. Logs accessible
4. Scheduling configurable
5. Real-time status
