# Restock Automation System

A production-ready BullMQ-based restock scheduler with email notifications and stock condition logic.

## Features

- **BullMQ Integration**: Uses Redis-backed job queue for reliable job processing
- **Flexible Scheduling**: Supports once, daily, weekly, and monthly recurrence patterns
- **Email Notifications**: Sends restock alerts via Resend API
- **Stock Monitoring**: Checks item stock against minimum quantity thresholds
- **Duplicate Prevention**: Prevents multiple notifications within the same minute
- **Error Handling**: Comprehensive error handling with retry logic
- **GraphQL Integration**: Seamlessly integrates with existing GraphQL mutations

## Architecture

### Directory Structure

```
src/
├── queue/
│   └── restock.queue.ts      # BullMQ queue configuration
├── workers/
│   └── restock.worker.ts     # Job processor
├── services/
│   └── email/
│       └── email.service.ts  # Email sending service
├── utils/
│   └── scheduler.ts          # Job registration utilities
└── graphql/
    └── resolvers/
        └── restock/
            └── restock.mutation.ts  # Updated GraphQL mutations
```

### Components

#### 1. Queue Setup (`src/queue/restock.queue.ts`)
- Creates BullMQ queue named `restock`
- Configures Redis connection
- Sets up default job options (retries, cleanup)

#### 2. Email Service (`src/services/email/email.service.ts`)
- Uses Resend API for email delivery
- Generates HTML email templates
- Handles email sending errors gracefully

#### 3. Scheduler Utils (`src/utils/scheduler.ts`)
- `registerRestockJob()`: Registers jobs based on recurrence type
- `removeRestockJob()`: Removes jobs from queue
- Supports cron patterns for recurring jobs
- Calculates delays for one-time jobs

#### 4. Worker (`src/workers/restock.worker.ts`)
- Processes restock jobs
- Checks stock conditions
- Sends email notifications
- Logs execution to `RestockItem` table
- Updates `lastTriggeredAt` timestamp

#### 5. GraphQL Integration
- Updated `createRestockSchedule` to register jobs
- Updated `updateRestockSchedule` to re-register jobs
- Updated `deleteRestockSchedule` to remove jobs

## Environment Variables

Add these to your `.env` file:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
RESEND_API_KEY=your_resend_api_key
```

## Usage

### Creating a Restock Schedule

```graphql
mutation CreateRestockSchedule($data: RestockScheduleInput!) {
  createRestockSchedule(data: $data) {
    id
    recurrence
    timeOfDay
    isActive
  }
}
```

### Variables

```json
{
  "data": {
    "itemId": 1,
    "recurrence": "daily",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T00:00:00Z",
    "timeOfDay": "22:00",
    "emailRecipient": "manager@company.com",
    "emailSubject": "Restock Alert",
    "emailBody": "Please restock this item immediately."
  }
}
```

### Recurrence Patterns

- **once**: Executes once at the specified `startDate` and `timeOfDay`
- **daily**: Executes daily at `timeOfDay`
- **weekly**: Executes weekly on `dayOfWeek` (0-6) at `timeOfDay`
- **monthly**: Executes monthly on `dayOfMonth` (1-31) at `timeOfDay`

## Database Schema

### RestockSchedule
- `lastTriggeredAt`: Tracks when the schedule was last executed
- Prevents duplicate executions within the same minute

### RestockItem
- Logs all restock notifications
- Tracks success/failure status
- Stores email details

## Error Handling

- Jobs retry up to 3 times with exponential backoff
- Failed jobs are logged to `RestockItem` with error details
- Email failures are marked as `failed` status
- Worker continues processing other jobs on individual failures

## Monitoring

- Worker logs all job completions and failures
- Check Redis for queued jobs: `redis-cli KEYS "bull:restock:*"`
- Monitor job status via BullMQ dashboard (optional)

## Development

1. Install dependencies:
   ```bash
   npm install bullmq ioredis resend
   ```

2. Set up Redis and ensure it's running

3. Configure environment variables

4. Start the application:
   ```bash
   npm run dev
   ```

The worker will automatically start processing jobs when the application starts.

## Production Considerations

- Use Redis cluster for high availability
- Monitor queue health and job failures
- Set up alerts for failed jobs
- Consider using BullMQ dashboard for monitoring
- Ensure Resend API key has sufficient quota