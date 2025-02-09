import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { GoogleMeetReportsService } from './google-meet-reports.service';
import { processActivities, SimplifiedMeetingActivity } from './meet-activity-transformer';
import { TinybirdIngestionService } from './tinybird-ingestion.service';
import { CalendarService } from './calendar.service';

@Controller()
export class AppController {
  constructor(
    private readonly googleMeetReportsService: GoogleMeetReportsService,
    private readonly tinybirdIngestionService: TinybirdIngestionService,
    private readonly calendarService: CalendarService,
  ) {}

  @Get('/push-meet-activities')
  async pushMeetActivities(@Query('date') date: string) {
    if (!date) {
      throw new HttpException(
        'Query parameter "date" is required in format YYYY-MM-DD',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // 1. Fetch raw activities from the Admin SDK.
      const rawData = await this.googleMeetReportsService.fetchMeetActivities(date);

      // 2. Transform raw activities into the simplified structure.
      let simplified: SimplifiedMeetingActivity[] = processActivities(rawData.items || []);

      // 3. Enrich each activity with the meeting name from the Calendar API.
      //    Here, we assume the calendarId is 'primary'. Adjust if necessary.
      for (const activity of simplified) {
        if (activity.calendarEventId) {
          // Instead of 'primary', use the organizerEmail for the calendar ID
          const meetingName = await this.calendarService.getEventTitle(
            activity.organizerEmail,
            activity.calendarEventId
          );
          (activity as any).meetingName = meetingName;
        } else {
          (activity as any).meetingName = '';
        }
      }
      

      if (simplified.length === 0) {
        return { message: 'No relevant Google Meet activities found for the specified date.' };
      }

      // Convert isExternal -> 0/1
      const dataForTinybird = simplified.map(item => ({
        ...item,
        isExternal: item.isExternal ? 1 : 0,
      }));

      // Now push
      await this.tinybirdIngestionService.pushData(dataForTinybird);

      return { message: 'Data pushed to Tinybird successfully.' };
    } catch (error) {
      throw new HttpException(
        'Failed to push Google Meet activities data to Tinybird',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
