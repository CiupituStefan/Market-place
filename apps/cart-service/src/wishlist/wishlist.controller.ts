import { Authenticated, CurrentUser, openApiSchema, ZodValidationPipe } from '@market/nest-common';
import type { AuthUser, WishlistItem } from '@market/types';
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { WishlistService } from './wishlist.service.js';

const AddSchema = z.object({ variantId: z.uuid() }).strict();
const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('wishlist')
@Controller('wishlist')
@Authenticated()
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<WishlistItem[]> {
    return this.wishlist.list(user.id);
  }

  @Post('items')
  @ApiBody({ schema: openApiSchema(AddSchema) })
  add(
    @Body(new ZodValidationPipe(AddSchema)) body: z.infer<typeof AddSchema>,
    @CurrentUser() user: AuthUser,
  ): Promise<WishlistItem[]> {
    return this.wishlist.add(user.id, body.variantId);
  }

  @Delete('items/:variantId')
  remove(
    @Param('variantId', uuid) variantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<WishlistItem[]> {
    return this.wishlist.remove(user.id, variantId);
  }
}
