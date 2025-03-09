import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { GoogleMeetReportsService } from './google-meet-reports.service';
import { processActivities, SimplifiedMeetingActivity } from './meet-activity-transformer';
import { TinybirdIngestionService } from './tinybird-ingestion.service';
import { CalendarService } from './calendar.service';
import { SingleMeetService } from './single-meet.service';

/**
 * Minimal attendee interface without displayName
 */
interface Attendee {
  email: string;
  responseStatus: string; // e.g. "accepted", "tentative", "needsAction", "declined", etc.
}

@Controller()
export class AppController {
  constructor(
    private readonly singleMeetService: SingleMeetService,
    private readonly googleMeetReportsService: GoogleMeetReportsService,
    private readonly tinybirdIngestionService: TinybirdIngestionService,
    private readonly calendarService: CalendarService,
  ) {}

  // ----------------------------------------------------------------------------
  // 1) Endpoint: Fetch a single event by conferenceId, get event title + attendees
  // ----------------------------------------------------------------------------
  @Get('/test-meet')
  async testMeet(
    @Query('conferenceId') conferenceId: string,
  ): Promise<{
    message: string;
    rawAdminSdkData?: any;
    meetingName: string;
    organizerEmail: string;
    calendarEventId: string;
    calendarIdUsed: string;
    attendees: Attendee[];
  }> {
    if (!conferenceId) {
      throw new HttpException(
        'Query parameter "conferenceId" is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1A) Fetch raw data from the Admin SDK logs
    const eventData = await this.singleMeetService.fetchSingleEventByConferenceId(conferenceId);
    const items = eventData?.items || [];

    if (items.length === 0) {
      return {
        message: `No meet activities found for conferenceId: ${conferenceId}`,
        meetingName: '',
        organizerEmail: '',
        calendarEventId: '',
        calendarIdUsed: '',
        attendees: [],
      };
    }

    // 1B) Focus on the first item in the logs
    const firstItem = items[0];
    const firstEvent = firstItem.events?.[0];
    if (!firstEvent) {
      return {
        message: `No events found in the first meet activity for conferenceId: ${conferenceId}`,
        meetingName: '',
        organizerEmail: '',
        calendarEventId: '',
        calendarIdUsed: '',
        attendees: [],
      };
    }

    // 1C) Extract relevant parameters
    const parameters = firstEvent.parameters || [];
    let calendarEventId = '';
    let organizerEmail = '';
    let participantEmail = '';

    parameters.forEach((param) => {
      if (param.name === 'calendar_event_id') {
        calendarEventId = param.value;
      } else if (param.name === 'organizer_email') {
        organizerEmail = param.value;
      } else if (param.name === 'identifier') {
        participantEmail = param.value;
      }
    });

    // 1D) Decide which user's calendar to call
    let calendarIdToUse = organizerEmail;
    if (!organizerEmail.endsWith('@litebox.ai')) {
      // fallback to the in-domain participant
      calendarIdToUse = participantEmail;
    }

    // 1E) Attempt to fetch meeting details (summary + attendees)
    let meetingName = '';
    let attendees: Attendee[] = [];

    if (calendarEventId && calendarIdToUse) {
      const eventDetails = await this.calendarService.getEventDetails(calendarIdToUse, calendarEventId);
      meetingName = eventDetails.summary;
      attendees = eventDetails.attendees.map((a) => ({
        email: a.email,
        responseStatus: a.responseStatus,
      }));
    }

    // 1F) Return
    return {
      message: `Fetched event logs for conferenceId: ${conferenceId}.`,
      rawAdminSdkData: firstItem,
      meetingName,
      organizerEmail,
      calendarEventId,
      calendarIdUsed: calendarIdToUse,
      attendees,
    };
  }

  // ----------------------------------------------------------------------------
  // 2) Endpoint: Push meet activities to Tinybird (including attendees)
  // ----------------------------------------------------------------------------
  @Get('/push-meet-activities')
  async pushMeetActivities(@Query('date') date: string) {
    if (!date) {
      throw new HttpException(
        'Query parameter "date" is required in format YYYY-MM-DD',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // 2A) Fetch raw activities
      const rawData = await this.googleMeetReportsService.fetchMeetActivities(date);

      // 2B) Transform raw activities
      const simplified: SimplifiedMeetingActivity[] = processActivities(rawData.items || []);

      // 2C) Enrich each activity with the meeting name + minimal attendees
      for (const activity of simplified) {
        if (activity.calendarEventId && activity.organizerEmail) {
          const eventDetails = await this.calendarService.getEventDetails(
            activity.organizerEmail,
            activity.calendarEventId,
          );

          (activity as any).meetingName = eventDetails.summary;
          // Only keep email + responseStatus
          (activity as any).attendees = eventDetails.attendees.map((a) => ({
            email: a.email,
            responseStatus: a.responseStatus,
          }));
        } else {
          (activity as any).meetingName = '';
          (activity as any).attendees = [];
        }
      }

      if (simplified.length === 0) {
        return {
          message: 'No relevant Google Meet activities found for the specified date.',
        };
      }

      // 2D) Convert isExternal -> 0/1 and keep minimal attendees field
      const dataForTinybird = simplified.map((item) => ({
        ...item,
        isExternal: item.isExternal ? 1 : 0,
        attendees: (item as any).attendees || [],
      }));

      // 2E) Push data to Tinybird
      await this.tinybirdIngestionService.pushData(dataForTinybird);

      return { message: 'Data (without displayName) pushed to Tinybird successfully.' };
    } catch (error) {
      throw new HttpException(
        'Failed to push Google Meet activities (without displayName) data to Tinybird',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}