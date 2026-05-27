const payload = {"workspace_id":"test-workspace","event_type":"holiday","title":"New Year's Day","start_date":"2026-01-01T00:00:00Z","end_date":"2026-01-01T23:59:59Z","capacity_impact":1,"is_recurring":true,"recurrence_rule":"FREQ=YEARLY","auto_generated":true,"source_table":"holiday_providers","source_id":"test-source-id","timezone":"UTC"};

fetch("http://localhost:5001/api/calendar/events/upsert", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJpYXQiOjE1MTYyMzkwMjJ9.signature"
    },
    body: JSON.stringify(payload)
}).then(async r => {
    console.log(r.status);
    console.log(await r.text());
}).catch(console.error);
