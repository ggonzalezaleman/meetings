import { Job, cronTrigger } from "@trigger.dev/sdk";
import axios from "axios";

const NEST_APP_URL = process.env.NEST_APP_URL;
if (!NEST_APP_URL) {
  throw new Error("NEST_APP_URL is not defined in environment variables");
}

export const fetchGoogleMeetAtMidnight = new Job({
  // A unique ID for this job
  id: "fetch-google-meet-at-midnight",
  // Provide a descriptive name
  name: "Fetch Google Meet at Midnight",
  // Provide a job version (e.g., "1.0.0" or "0.0.1")
  version: "1.0.0",

  // The trigger: run every day at midnight UTC
  trigger: cronTrigger({
    cron: "10 5 * * *",
  }),

  // The main job function
  run: async (payload, io, ctx) => {
    // Determine "yesterday's" date in YYYY-MM-DD
    const today = new Date();
    const yesterdaysDate = new Date(today);
    yesterdaysDate.setDate(today.getDate() - 1);
    const dateParam = yesterdaysDate.toISOString().split("T")[0];

    // Build the NestJS endpoint URL
    const url = `${NEST_APP_URL}/push-meet-activities?date=${dateParam}`;
    io.logger.info(`Trigger.dev is calling: ${url}`);

    try {
      // Make the HTTP GET request to your NestJS endpoint
      const response = await axios.get(url);
      io.logger.info(`NestJS response: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      io.logger.error(`Failed to push Google Meet activities: ${error.message}`);
      throw error;
    }

    return { message: "Successfully fetched and pushed yesterday's Meet activities." };
  },
});
