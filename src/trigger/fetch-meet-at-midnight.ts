import { schedules, logger } from "@trigger.dev/sdk/v3";
import axios from "axios";

// This task runs every day at 05:10 UTC and calls your NestJS endpoint
// to push yesterday’s Google Meet activities.
export const fetchGoogleMeetAtMidnight = schedules.task({
  id: "fetch-google-meet-at-midnight",   // Unique task ID
  cron: "0 3 * * *",                    // Runs every day at 05:10 UTC
  maxDuration: 300,                      // Optional: maximum duration in seconds (5 minutes)
  run: async (payload) => {
    // The payload contains scheduling metadata, including timestamp.
    // Use payload.timestamp as the scheduled run time.
    const scheduledTime = payload.timestamp;
    
    // Calculate yesterday's date based on the scheduled timestamp.
    const yesterday = new Date(scheduledTime);
    yesterday.setDate(scheduledTime.getDate() - 1);
    const dateParam = yesterday.toISOString().split("T")[0]; // "YYYY-MM-DD"
    
    // Get the NestJS API URL from environment variables.
    // Make sure that in your environment (Vercel dashboard) NEST_APP_URL is set to the URL
    // where your NestJS app is deployed (e.g., "https://litebox-meetings-backend.vercel.app")
    const nestUrl = process.env.NEST_APP_URL;
    if (!nestUrl) {
      throw new Error("NEST_APP_URL is not defined in environment variables");
    }
    
    // Build the full URL for the push-meet-activities endpoint.
    const endpoint = `${nestUrl}/fetch-date-range?start=${dateParam}&end=${dateParam}`;
    logger.info(`Trigger task calling endpoint: ${endpoint}`);
    
    // Call your NestJS endpoint.
    const response = await axios.get(endpoint);
    logger.info(`NestJS response: ${JSON.stringify(response.data)}`);
    
    // Return any data or a message (this will show in the Trigger.dev dashboard logs).
    return { message: "Successfully fetched and pushed yesterday's Meet activities." };
  }
});
