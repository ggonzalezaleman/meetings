import { VercelRequest, VercelResponse } from "@vercel/node";
import { TriggerClient, cronTrigger } from "@trigger.dev/sdk";
import axios from "axios";

const client = new TriggerClient({
  id: "my-vercel-trigger-client",
  apiKey: process.env.TRIGGER_API_KEY!, // set in Vercel env
});

// Define the job inline
client.defineJob({
  id: "fetch-google-meet-at-midnight",
  name: "Fetch Google Meet at Midnight",
  version: "1.0.0",
  trigger: cronTrigger({
    cron: "10 5 * * *", // runs at midnight UTC daily
  }),
  run: async (payload, io, ctx) => {
    const nestUrl = process.env.NEST_APP_URL;
    if (!nestUrl) {
      throw new Error("NEST_APP_URL is not defined");
    }

    // Calculate yesterday's date
    const today = new Date();
    const yesterdaysDate = new Date(today);
    yesterdaysDate.setDate(today.getDate() - 1);
    const dateParam = yesterdaysDate.toISOString().split("T")[0];

    const endpoint = `${nestUrl}/push-meet-activities?date=${dateParam}`;
    io.logger.info(`Trigger.dev calling: ${endpoint}`);

    try {
      const response = await axios.get(endpoint);
      io.logger.info(`NestJS response: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      io.logger.error(`Failed to fetch data: ${error.message}`);
      throw error;
    }

    return { message: "Successfully fetched & pushed yesterday's data." };
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Convert the Vercel req to a minimal fetch-style Request
  const url = `https://${req.headers.host}${req.url}`;
  const method = req.method ?? "GET";
  const fetchRequest = new Request(url, {
    method,
    headers: new Headers(req.headers as any),
    body: ["POST", "PUT", "PATCH", "DELETE"].includes(method) ? (req as any) : undefined,
  });

  // client.handleRequest() returns an object like: { status, headers?: Record<string,string>, body?: any }
  const triggerResponse = await client.handleRequest(fetchRequest);

  // Apply the returned status & headers to Vercel's response
  res.status(triggerResponse.status || 200);

  if (triggerResponse.headers) {
    for (const [key, value] of Object.entries(triggerResponse.headers)) {
      res.setHeader(key, value);
    }
  }

  // The body can be anything: string, object, etc.
  if (typeof triggerResponse.body === "string") {
    res.send(triggerResponse.body);
  } else {
    // If it's an object or something else, you might want to JSON-ify
    res.json(triggerResponse.body);
  }
}
