import { Controller, Get, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GoogleMeetReportsService } from './google-meet-reports.service';
import { TinybirdIngestionService } from './tinybird-ingestion.service';
import { CalendarService } from './calendar.service';
import { processActivities, SimplifiedMeetingActivity } from './meet-activity-transformer';

@Controller()
export class FetchRangeController {
  private readonly logger = new Logger(FetchRangeController.name);

  constructor(
    private readonly googleMeetReportsService: GoogleMeetReportsService,
    private readonly tinybirdIngestionService: TinybirdIngestionService,
    private readonly calendarService: CalendarService,
  ) {}

  /**
   * GET /fetch-range?days=180
   * This endpoint fetches Google Meet data for the past `days` days (default 180) 
   * and pushes it to Tinybird. For each day, it:
   *  1) Gets activities from the Admin SDK
   *  2) Transforms them
   *  3) Enriches with meeting name (Calendar API) if available
   *  4) Pushes to Tinybird
   */
  @Get('/fetch-range')
  async fetchRange(@Query('days') daysQuery: string) {
    // 1) Parse the `days` query param; default to 180 if not given or invalid
    let days = parseInt(daysQuery, 10);
    if (isNaN(days) || days < 1) {
      days = 180;
    }

    const today = new Date();
    let totalActivities = 0;

    // 2) Loop from 1..days, retrieving data for each date
    for (let i = 1; i <= days; i++) {
      // Compute the target date: "today minus i days"
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);

      // Format as YYYY-MM-DD
      const dateParam = targetDate.toISOString().split('T')[0];
      this.logger.log(`Fetching Google Meet data for date: ${dateParam}`);

      try {
        // 3) Fetch raw data from Admin SDK
        const rawData = await this.googleMeetReportsService.fetchMeetActivities(dateParam);
        // 4) Transform raw data
        let simplified: SimplifiedMeetingActivity[] = processActivities(rawData.items || []);

        // 5) Optionally enrich with Calendar event title
        for (const activity of simplified) {
          if (activity.calendarEventId) {
            // If all events are on "primary" or if you need the organizerEmail, change here
            const meetingName = await this.calendarService.getEventTitle(
                activity.organizerEmail,
                activity.calendarEventId
              );              
            (activity as any).meetingName = meetingName;
          } else {
            (activity as any).meetingName = '';
          }
        }

        // 6) Push into Tinybird if there's any data
        if (simplified.length > 0) {
            const dataForTinybird = simplified.map(item => ({
              ...item,
              isExternal: item.isExternal ? 1 : 0,
            }));
      
            await this.tinybirdIngestionService.pushData(dataForTinybird);
            this.logger.log(`Pushed ${simplified.length} records for ${dateParam} to Tinybird.`);
            totalActivities += simplified.length;
          } else {
          this.logger.log(`No activities found for ${dateParam}.`);
        }
      } catch (error) {
        this.logger.error(`Error processing date ${dateParam}:`, error);
        // Optionally you can `throw error;` to fail altogether or continue the loop
      }
    }

    // Return a simple summary
    return {
      message: `Fetched and pushed data for the past ${days} day(s).`,
      totalActivities,
    };
  }
}
