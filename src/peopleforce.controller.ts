import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PeopleForceService } from './peopleforce.service';
import { TinybirdEmployeeIngestionService } from './tinybird-employee-ingestion.service';

@Controller('peopleforce')
export class PeopleForceController {
  constructor(
    private readonly peopleForceService: PeopleForceService,
    private readonly tinybirdEmployeeIngestionService: TinybirdEmployeeIngestionService,
  ) {}

  /**
   * GET /peopleforce/push
   * This endpoint fetches PeopleForce employee data, transforms it,
   * and pushes it into Tinybird using the employee data source.
   */
  @Get('push')
  async pushEmployees() {
    try {
      const employees = await this.peopleForceService.getTransformedEmployees();
      if (employees.length === 0) {
        return { message: 'No employee data found from PeopleForce.' };
      }

      await this.tinybirdEmployeeIngestionService.pushData(employees);
      return {
        message: 'Employee data pushed to Tinybird successfully.',
        totalEmployees: employees.length,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to push employee data to Tinybird',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
