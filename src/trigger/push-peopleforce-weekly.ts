import { schedules, logger } from "@trigger.dev/sdk/v3";
import axios from "axios";

export const pushPeopleForceWeekly = schedules.task({
  id: "push-peopleforce-weekly",   // Unique task ID
  cron: "0 3 * * 1",                    // Runs daily at 03:00 UTC
  maxDuration: 300,
  run: async () => {
    const nestUrl = process.env.NEST_APP_URL;
    if (!nestUrl) {
      throw new Error("NEST_APP_URL is not defined in environment variables");
    }

    const endpoint = `${nestUrl}/peopleforce/push`;
    logger.info(`Trigger task calling endpoint: ${endpoint}`);

    const response = await axios.get(endpoint);
    logger.info(`NestJS response: ${JSON.stringify(response.data)}`);

    return { message: "Successfully triggered the PeopleForce push." };
  },
});