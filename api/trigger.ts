import { VercelRequest, VercelResponse } from "@vercel/node";
import { TriggerClient, cronTrigger } from "@trigger.dev/sdk";
import axios from "axios";

// Create the TriggerClient with your API key
const client = new TriggerClient({
  id: "my-vercel-trigger-client",
  apiKey: process.env.TRIGGER_API_KEY!, // must be set in Vercel environment variables
});

// Define the cron job inline
client.defineJob({
  id: "fetch-google-meet-at-midnight",
  name: "Fetch Google Meet at Midnight",
  version: "1.0.0",
  trigger: cronTrigger({
    // Example: runs daily at 05:10 UTC
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
  // Force the method to POST regardless of the incoming method,
  // since Trigger.dev expects a POST request.
  const method = "POST";
  // Clone the incoming headers and force an x-trigger-action header if missing.
  const customHeaders = new Headers(req.headers as any);
  if (!customHeaders.has("x-trigger-action")) {
    customHeaders.set("x-trigger-action", "my-cron");
  }

  const url = `https://${req.headers.host}${req.url}`;
  const fetchRequestInit: RequestInit = {
    method,
    headers: customHeaders,
    // We omit a body for GET/POST since our endpoint does not require one.
  };

  const fetchRequest = new Request(url, fetchRequestInit);

  // Call handleRequest.
  // We force a type cast here to allow our options if needed.
  const triggerResponse = await (client as any).handleRequest(fetchRequest);

  res.status(triggerResponse.status || 200);

  if (triggerResponse.headers) {
    for (const [key, value] of Object.entries(triggerResponse.headers)) {
      res.setHeader(key, String(value));
    }
  }

  if (typeof triggerResponse.body === "string") {
    res.send(triggerResponse.body);
  } else {
    res.json(triggerResponse.body);
  }
}
