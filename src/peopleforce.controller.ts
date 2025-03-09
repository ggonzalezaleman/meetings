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
   * and replaces all existing Tinybird data with the new data.
   */
  @Get('push')
  async pushEmployees() {
    try {
      const employees = await this.peopleForceService.getTransformedEmployees();
      
      if (employees.length === 0) {
        return { message: 'No employee data found from PeopleForce.' };
      }

      // 1. Remove all existing data in Tinybird
      await this.tinybirdEmployeeIngestionService.deleteAllData();

      // 2. Push the new data set
      await this.tinybirdEmployeeIngestionService.pushData(employees);

      return {
        message: 'Employee data replaced in Tinybird successfully.',
        totalEmployees: employees.length,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to replace employee data in Tinybird',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}