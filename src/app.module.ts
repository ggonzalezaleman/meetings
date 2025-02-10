import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GoogleMeetReportsService } from './google-meet-reports.service';
import { TinybirdIngestionService } from './tinybird-ingestion.service';
import { CalendarService } from './calendar.service';
import { FetchDateRangeController } from './fetch-date-range.controller';
import { PeopleForceService } from './peopleforce.service';
import { PeopleForceController } from './peopleforce.controller';
import { TinybirdEmployeeIngestionService } from './tinybird-employee-ingestion.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController, FetchDateRangeController, PeopleForceController],
  providers: [
    AppService,
    GoogleMeetReportsService,
    TinybirdIngestionService,
    CalendarService,
    PeopleForceService,
    TinybirdEmployeeIngestionService,
  ],
})
export class AppModule {}
