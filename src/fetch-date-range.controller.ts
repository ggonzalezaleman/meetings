import { Controller, Get, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GoogleMeetReportsService } from './google-meet-reports.service';
import { TinybirdIngestionService } from './tinybird-ingestion.service';
import { CalendarService } from './calendar.service';
import { processActivities, SimplifiedMeetingActivity } from './meet-activity-transformer';

@Controller()
export class FetchDateRangeController {
  private readonly logger = new Logger(FetchDateRangeController.name);

  constructor(
    private readonly googleMeetReportsService: GoogleMeetReportsService,
    private readonly tinybirdIngestionService: TinybirdIngestionService,
    private readonly calendarService: CalendarService,
  ) {}

  /**
   * GET /fetch-date-range?start=YYYY-MM-DD&end=YYYY-MM-DD
   *
   * Example: /fetch-date-range?start=2024-11-01&end=2024-11-30
   *
   * This endpoint loops from the start date to the end date (inclusive),
   * fetching Google Meet data day by day, then pushes it to Tinybird.
   */
  @Get('/fetch-date-range')
  async fetchDateRange(
    @Query('start') startStr: string,
    @Query('end') endStr: string
  ) {
    if (!startStr || !endStr) {
      throw new HttpException(
        'Query params "start" and "end" (YYYY-MM-DD) are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1) Parse the start & end dates. If invalid, throw.
    let startDate: Date;
    let endDate: Date;
    try {
      startDate = new Date(`${startStr}T00:00:00Z`);
      endDate = new Date(`${endStr}T00:00:00Z`);
    } catch (error) {
      throw new HttpException(
        'Invalid date format. Use YYYY-MM-DD in "start" and "end".',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new HttpException(
        'Invalid date string. Use YYYY-MM-DD format.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (startDate > endDate) {
      throw new HttpException(
        '"start" date cannot be after "end" date.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let totalActivities = 0;
    // We'll iterate day by day from startDate to endDate
    // adjusting the date cursor forward in a loop.
    const dateCursor = new Date(startDate);

    while (dateCursor <= endDate) {
      const dateParam = dateCursor.toISOString().split('T')[0]; // "YYYY-MM-DD"
      this.logger.log(`Fetching data for ${dateParam}...`);

      try {
        // 2) Fetch raw data from Admin SDK for that day
        const rawData = await this.googleMeetReportsService.fetchMeetActivities(dateParam);

        // 3) Transform raw data
        let simplified: SimplifiedMeetingActivity[] = processActivities(rawData.items || []);

        // 4) Optionally enrich with the Calendar event title
        for (const activity of simplified) {
          if (activity.calendarEventId) {
            // Use the same logic as your push-meet-activities code
            // Either "primary" or 'organizerEmail'
            const meetingName = await this.calendarService.getEventTitle(
              activity.organizerEmail,
              activity.calendarEventId
            );
            (activity as any).meetingName = meetingName;
          } else {
            (activity as any).meetingName = '';
          }
        }

        // 5) Push the data to Tinybird if there's anything
        if (simplified.length > 0) {
          // If your Tinybird column for isExternal is UInt8, remember to convert:
          const dataForTinybird = simplified.map(item => ({
            ...item,
            isExternal: item.isExternal ? 1 : 0,
          }));

          await this.tinybirdIngestionService.pushData(dataForTinybird);
          this.logger.log(`Pushed ${simplified.length} records for ${dateParam} to Tinybird.`);
          totalActivities += simplified.length;
        } else {
          this.logger.log(`No relevant data for ${dateParam}.`);
        }
      } catch (error) {
        this.logger.error(`Error processing date ${dateParam}:`, error);
        // Either throw or continue to the next date
      }

      // 6) Move cursor ahead by 1 day
      dateCursor.setDate(dateCursor.getDate() + 1);
    }

    return {
      message: `Fetched & pushed data from ${startStr} to ${endStr}.`,
      totalActivities,
    };
  }
}
