import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Use the Tinybird US-East AWS endpoint (or override via .env if needed)
const TINYBIRD_API_URL = process.env.TINYBIRD_API_URL || 'https://api.us-east.aws.tinybird.co/v0/events';

// Your Tinybird Ingestion Token (set this in your .env file)
const TINYBIRD_TOKEN = process.env.TINYBIRD_TOKEN || 'p.eyJ1IjogIjhlOWQ5NTczLTFlZTMtNGVmNi1hOGVkLTZjMTg5ZjNhNWEyMyIsICJpZCI6ICI1YWZkMDIyMy01MTY2LTQwYjktOGQ2MC1hNzIzMjRiNWZhYWYiLCAiaG9zdCI6ICJ1cy1lYXN0LWF3cyJ9.jIWlaT8ZOQJfzCejzgGhp9BHSZiPGRFBO7hMaqS0TyE';

// Define the name of the data source you want to create for PeopleForce employees
const DATA_SOURCE_NAME = 'peopleforce_employees';

async function createPeopleForceDataSource() {
  // This sample payload uses a simplified PeopleForce employee schema.
  // It includes key fields:
  // - employeeId: number
  // - employeeNumber: string
  // - fullName: string
  // - email: string
  // - position: string (or null)
  // - department: string (or null)
  // - division: string (or null)
  // - reportingToId: number (or null)
  // - reportingToEmail: string (or null)
  // - reportingToFullName: string (concatenation of reporting_to.first_name and reporting_to.last_name, or null)
  const sampleEmployee = {
    employeeId: 377338,
    employeeNumber: "78",
    fullName: "Abril Del Burgo",
    email: "adelburgo@litebox.ai",
    position: "QA Lead",
    department: null as string | null,
    division: null as string | null,
    reportingToId: null as string | null,
    reportingToEmail: null as string | null,
    reportingToFullName: null as string | null
  };

  // Build the full URL with the data source name as a query parameter.
  const url = `${TINYBIRD_API_URL}?name=${DATA_SOURCE_NAME}`;

  try {
    const response = await axios.post(url, sampleEmployee, {
      headers: {
        'Authorization': `Bearer ${TINYBIRD_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log("Tinybird PeopleForce Data Source created successfully:");
    console.log(response.data);
  } catch (error: any) {
    console.error("Error creating Tinybird PeopleForce Data Source:");
    if (error.response && error.response.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

// Execute the function when the file is run.
createPeopleForceDataSource();
