import { Authenticated, CurrentUser, openApiSchema, ZodValidationPipe } from '@market/nest-common';
import type { AuthUser, Paginated, Role } from '@market/types';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListUsersQuerySchema, UpdateRolesSchema, type UserResponse } from '../auth/dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users (back office)')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Authenticated('STAFF', 'ADMIN')
  @ApiOperation({ summary: 'List customers and staff' })
  list(
    @Query(new ZodValidationPipe(ListUsersQuerySchema))
    query: {
      page: number;
      pageSize: number;
      q?: string;
    },
  ): Promise<Paginated<UserResponse>> {
    return this.users.list(query);
  }

  @Get(':id')
  @Authenticated('STAFF', 'ADMIN')
  @ApiOperation({ summary: 'One account (customer detail in the back office)' })
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<UserResponse> {
    return this.users.get(id);
  }

  @Patch(':id/roles')
  @Authenticated('ADMIN')
  @ApiOperation({ summary: 'Change roles (ADMIN only); signs the user out everywhere' })
  @ApiBody({ schema: openApiSchema(UpdateRolesSchema) })
  updateRoles(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateRolesSchema)) body: { roles: Role[] },
  ): Promise<UserResponse> {
    return this.users.updateRoles(actor.id, id, body.roles);
  }
}
