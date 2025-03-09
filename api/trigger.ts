import { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow only POST requests for triggering.
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed. Use POST." });
    return;
  }
  
  try {
    // Calculate yesterday's date in YYYY-MM-DD format.
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dateParam = yesterday.toISOString().split("T")[0];
    
    // Use the environment variable for your NestJS API URL.
    // IMPORTANT: Make sure that NEST_APP_URL is set to the root URL where your NestJS app is served.
    // For example, if your Nest app is served via api/index.ts and routes are available at the root,
    // set NEST_APP_URL=https://litebox-meetings-backend.vercel.app
    const nestUrl = process.env.NEST_APP_URL;
    if (!nestUrl) {
      throw new Error("NEST_APP_URL is not defined in environment variables");
    }
    
    // Build the endpoint URL for push-meet-activities.
    // Since your NestJS endpoint for push-meet-activities is defined with @Get,
    // we must use GET to call it.
    const endpoint = `${nestUrl}/fetch-date-range?start=${dateParam}&end=${dateParam}`;
    console.log(`Trigger function calling: ${endpoint}`);
    
    // Make a GET request to your NestJS endpoint.
    const response = await axios.get(endpoint);
    console.log("Response from push-meet-activities:", response.data);
    
    res.status(200).json({
      success: true,
      message: `Successfully triggered push-meet-activities for date ${dateParam}`,
      data: response.data,
    });
  } catch (error: any) {
    console.error("Error triggering push-meet-activities:", error);
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while triggering push-meet-activities.",
    });
  }
}