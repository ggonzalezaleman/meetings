import { VercelRequest, VercelResponse } from "@vercel/node";
// Use the built-in fetch (available in Node 18+) or install node-fetch if needed.
// import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests (Trigger.dev will call via POST)
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  try {
    // Determine the base URL for your NestJS API.
    // Use the environment variable NEST_APP_URL if provided; otherwise, default to localhost.
    let nestUrl = process.env.NEST_APP_URL || "http://localhost:3000";
    
    // Use HTTP for localhost; otherwise, ensure the URL has a protocol.
    if (nestUrl.includes("localhost")) {
      nestUrl = nestUrl.replace("https://", "http://");
    } else if (!nestUrl.startsWith("http://") && !nestUrl.startsWith("https://")) {
      nestUrl = `https://${nestUrl}`;
    }

    // Calculate yesterday's date in YYYY-MM-DD format.
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dateParam = yesterday.toISOString().split("T")[0]; // e.g. "2025-02-07"

    // Build the full endpoint URL.
    const endpoint = `${nestUrl}/push-meet-activities?date=${dateParam}`;
    console.log(`Trigger function calling: ${endpoint}`);

    // Call the NestJS endpoint.
    const response = await fetch(endpoint);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} response: ${errorText}`);
    }
    const data = await response.json();
    console.log("Data pushed successfully:", data);

    // Return a JSON response indicating success.
    res.status(200).json({
      success: true,
      message: `Data pushed successfully for date: ${dateParam}`,
      data,
    });
  } catch (error: any) {
    console.error("Error in trigger function:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to push data.",
    });
  }
}
