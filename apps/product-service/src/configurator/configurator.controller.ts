import { openApiSchema, ZodValidationPipe } from '@market/nest-common';
import {
  ConfigurationQuoteSchema,
  ConfigurationSelectionSchema,
  ConfiguratorSchema,
  type ConfigurationQuote,
  type ConfigurationSelection,
  type Configurator,
} from '@market/types';
import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SlugSchema } from '../catalog/dto.js';
import { ConfiguratorService } from './configurator.service.js';

const QuoteRequestSchema = z.object({ selection: ConfigurationSelectionSchema }).strict();

@ApiTags('configurator')
@Controller('configurator')
export class ConfiguratorController {
  constructor(private readonly configurator: ConfiguratorService) {}

  @Get(':slug')
  @Header('cache-control', 'public, max-age=60, stale-while-revalidate=300')
  @ApiOkResponse({ schema: openApiSchema(ConfiguratorSchema) })
  definition(
    @Param('slug', new ZodValidationPipe(SlugSchema)) slug: string,
  ): Promise<Configurator> {
    return this.configurator.definition(slug);
  }

  @Post(':slug/quote')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Validate a selection and price it (server-side rules, deterministic configuration id)',
  })
  @ApiBody({ schema: openApiSchema(QuoteRequestSchema) })
  @ApiOkResponse({ schema: openApiSchema(ConfigurationQuoteSchema) })
  quote(
    @Param('slug', new ZodValidationPipe(SlugSchema)) slug: string,
    @Body(new ZodValidationPipe(QuoteRequestSchema)) body: { selection: ConfigurationSelection },
  ): Promise<ConfigurationQuote> {
    return this.configurator.quote(slug, body.selection);
  }
}
