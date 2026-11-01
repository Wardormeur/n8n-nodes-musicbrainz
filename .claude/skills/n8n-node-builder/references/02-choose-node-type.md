# Choose a node type

Source: https://docs.n8n.io/connect/create-nodes/plan-your-node/choose-a-node-type.md

n8n has two primary node categories:

- **Trigger nodes** — special nodes responsible for executing the workflow in
  response to certain conditions. Every production workflow needs at least one.
  - **Webhook triggers** — for services that support webhooks; listen for events
    and trigger workflows in real time (e.g. Zendesk, Telegram, Brevo).
  - **Polling triggers** — for services that don't support webhooks; periodically
    check for new data and trigger on changes (e.g. Airtable, Gmail, Google Sheets).
  - **Other triggers** — real-time responses not tied to HTTP or polling: message
    queues (AMQP, RabbitMQ, MQTT), time-based (Schedule Trigger, Email IMAP).
- **Action nodes** — execute operations within a workflow: manipulate data or
  trigger events in an external service.

## Decision rule
- Third-party API supports webhooks → webhook trigger.
- No webhook support but needs to react to new/changed data → polling trigger.
- Message-queue or purely time-based → other trigger.
- Otherwise (CRUD-style calls to a service) → action node.

Trigger nodes always require the **programmatic** building style (see
[03-choose-building-style.md](03-choose-building-style.md)).
