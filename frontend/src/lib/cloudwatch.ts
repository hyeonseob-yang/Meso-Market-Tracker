import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

// Deliberately CLOUDWATCH_* rather than AWS_* — Vercel's own Lambda runtime
// sets AWS_REGION/AWS_ACCESS_KEY_ID/etc. itself, so user-supplied values
// under those names can be ignored or clobbered.
const LOG_GROUP = process.env.CLOUDWATCH_LOG_GROUP;
const LOG_STREAM = "vercel";

const client =
  process.env.CLOUDWATCH_ACCESS_KEY_ID && process.env.CLOUDWATCH_SECRET_ACCESS_KEY
    ? new CloudWatchLogsClient({
        region: process.env.CLOUDWATCH_REGION ?? "us-east-1",
        credentials: {
          accessKeyId: process.env.CLOUDWATCH_ACCESS_KEY_ID,
          secretAccessKey: process.env.CLOUDWATCH_SECRET_ACCESS_KEY,
        },
      })
    : null;

// The log stream only needs to be created once per warm function instance;
// cache the (in-flight or settled) promise so concurrent calls don't race.
let streamReady: Promise<void> | null = null;

function ensureStream(): Promise<void> {
  if (!streamReady) {
    streamReady = client!
      .send(new CreateLogStreamCommand({ logGroupName: LOG_GROUP, logStreamName: LOG_STREAM }))
      .then(() => undefined)
      .catch((err: { name?: string }) => {
        // Expected on every call after the first.
        if (err?.name !== "ResourceAlreadyExistsException") throw err;
      });
  }
  return streamReady;
}

/**
 * Logs to the console (always) and best-effort forwards to CloudWatch.
 * Never throws — a logging failure must not break the page render.
 */
export async function logError(message: string, ...meta: unknown[]) {
  console.error(message, ...meta);

  if (!client || !LOG_GROUP) return;

  try {
    await ensureStream();
    await client.send(
      new PutLogEventsCommand({
        logGroupName: LOG_GROUP,
        logStreamName: LOG_STREAM,
        logEvents: [{ timestamp: Date.now(), message: JSON.stringify({ message, meta }) }],
      }),
    );
  } catch (err) {
    console.error("failed to forward log to CloudWatch:", err);
  }
}
