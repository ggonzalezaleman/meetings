import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Use the Tinybird US-East AWS endpoint (or override via .env if needed)
const TINYBIRD_API_URL = process.env.TINYBIRD_API_URL || 'https://api.us-east.aws.tinybird.co/v0/events';

// Your Tinybird Ingestion Token (set this in your .env file)
const TINYBIRD_TOKEN = process.env.TINYBIRD_TOKEN;

// Define the name of the data source you want to create; in this case, we'll use "google_meet_events"
const DATA_SOURCE_NAME = 'google_meet_events';

async function createGoogleMeetDataSource() {
  // This sample payload uses the simplified Google Meet event schema.
  // It includes key fields: meetingCode, conferenceId, calendarEventId, organizerEmail,
  // participantEmail, participantDisplayName, startTimestamp, durationSeconds, isExternal,
  // and a nested location object with country and region.
  const sampleEvent = {
    meetingCode: "INZGBSJYMQ",
    conferenceId: "8BYeOiDd0iK3ojDY4ntEDxIUOAwLAjIGCIoCIAAYBQg",
    calendarEventId: "sample_calendar_event_id",
    organizerEmail: "ggonzaleza@litebox.ai",
    participantEmail: "luciano@pinkmaskgroup.com",
    participantDisplayName: "Luciano Silvestrini",
    startTimestamp: "2025-02-05T22:49:47.021Z",
    durationSeconds: 13960,
    isExternal: true,
    location: {
      country: "US",
      region: "Miami"
    }
  };

  // Build the full URL with the data source name as a query parameter.
  const url = `${TINYBIRD_API_URL}?name=${DATA_SOURCE_NAME}`;

  try {
    const response = await axios.post(url, sampleEvent, {
      headers: {
        'Authorization': `Bearer ${TINYBIRD_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log("Tinybird Data Source created successfully:");
    console.log(response.data);
  } catch (error: any) {
    console.error("Error creating Tinybird Data Source:");
    if (error.response && error.response.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

// Execute the function when the file is run.
createGoogleMeetDataSource();
