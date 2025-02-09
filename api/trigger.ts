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
    // Example: runs at 05:10 UTC every day
    cron: "10 5 * * *",
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
  // Build a fetch-style request, but do NOT pass the raw Vercel request as the body.
  const url = `https://${req.headers.host}${req.url}`;
  const method = req.method || "GET";

  // We won't attach a body or duplex because VercelRequest isn't valid BodyInit
  const fetchRequestInit: RequestInit = {
    method,
    headers: new Headers(req.headers as any),
    // no 'body' or 'duplex' property here
  };

  const fetchRequest = new Request(url, fetchRequestInit);

  // Let Trigger.dev handle the request
  const triggerResponse = await client.handleRequest(fetchRequest);

  // Convert the Trigger.dev style response back to a Node/Vercel response
  res.status(triggerResponse.status || 200);

  if (triggerResponse.headers) {
    for (const [key, value] of Object.entries(triggerResponse.headers)) {
      res.setHeader(key, value);
    }
  }

  if (typeof triggerResponse.body === "string") {
    res.send(triggerResponse.body);
  } else {
    res.json(triggerResponse.body);
  }
}
