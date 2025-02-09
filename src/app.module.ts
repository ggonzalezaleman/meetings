import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GoogleMeetReportsService } from './google-meet-reports.service';
import { TinybirdIngestionService } from './tinybird-ingestion.service';
import { CalendarService } from './calendar.service';
import { FetchDateRangeController } from './fetch-date-range.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [
    AppController,
    FetchDateRangeController, // Add this
  ],
  providers: [
    AppService,
    GoogleMeetReportsService,
    TinybirdIngestionService,
    CalendarService,
  ],
})
export class AppModule {}
