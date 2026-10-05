import {
  MaybeUser,
  OptionallyAuthenticated,
  openApiSchema,
  ZodValidationPipe,
} from '@market/nest-common';
import {
  ConfigurationSelectionSchema,
  MAX_LINE_QUANTITY,
  type AuthUser,
  type Cart,
} from '@market/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { applyCookie, identityOf } from './cart-cookie.js';
import { CartService, type CookieInstruction } from './cart.service.js';

const quantity = z.int().min(1).max(MAX_LINE_QUANTITY);

const AddItemSchema = z.object({ variantId: z.uuid(), quantity: quantity.default(1) }).strict();
const AddConfigurationSchema = z
  .object({
    configurator: z.string().trim().min(1).max(64),
    selection: ConfigurationSelectionSchema,
    quantity: quantity.default(1),
  })
  .strict();
const UpdateItemSchema = z.object({ quantity }).strict();
const CouponSchema = z.object({ code: z.string().trim().min(1).max(40) }).strict();

const uuid = new ParseUUIDPipe({ version: '4' });

/**
 * The shopper's cart. Visitors are identified by an httpOnly `cse_cart` cookie,
 * signed-in users by their access token; signing in merges the visitor cart.
 * Every response is the full cart, re-priced on the server.
 */
@ApiTags('cart')
@Controller('cart')
@OptionallyAuthenticated()
export class CartController {
  constructor(
    private readonly carts: CartService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private reply(res: Response, result: { cart: Cart; cookie: CookieInstruction }): Cart {
    applyCookie(res, result.cookie, this.config);
    // Per-shopper and price-sensitive: never cache.
    res.setHeader('Cache-Control', 'no-store');
    return result.cart;
  }

  @Get()
  @ApiOperation({ summary: 'Current cart with server-computed totals and notices' })
  async get(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @MaybeUser() user?: AuthUser,
  ): Promise<Cart> {
    return this.reply(res, await this.carts.view(identityOf(req, user?.id)));
  }

  @Post('items')
  @ApiOperation({ summary: 'Add a product variant (quantities add up)' })
  @ApiBody({ schema: openApiSchema(AddItemSchema) })
  async addItem(
    @Body(new ZodValidationPipe(AddItemSchema)) body: z.infer<typeof AddItemSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @MaybeUser() user?: AuthUser,
  ): Promise<Cart> {
    const result = await this.carts.addVariant(
      identityOf(req, user?.id),
      body.variantId,
      body.quantity,
    );
    return this.reply(res, result);
  }

  @Post('configurations')
  @ApiOperation({ summary: 'Add a configurator build (validated and priced by product-service)' })
  @ApiBody({ schema: openApiSchema(AddConfigurationSchema) })
  async addConfiguration(
    @Body(new ZodValidationPipe(AddConfigurationSchema))
    body: z.infer<typeof AddConfigurationSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @MaybeUser() user?: AuthUser,
  ): Promise<Cart> {
    const result = await this.carts.addConfiguration(
      identityOf(req, user?.id),
      body.configurator,
      body.selection,
      body.quantity,
    );
    return this.reply(res, result);
  }

  @Patch('items/:itemId')
  @ApiBody({ schema: openApiSchema(UpdateItemSchema) })
  async updateItem(
    @Param('itemId', uuid) itemId: string,
    @Body(new ZodValidationPipe(UpdateItemSchema)) body: z.infer<typeof UpdateItemSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @MaybeUser() user?: AuthUser,
  ): Promise<Cart> {
    const result = await this.carts.updateQuantity(
      identityOf(req, user?.id),
      itemId,
      body.quantity,
    );
    return this.reply(res, result);
  }

  @Delete('items/:itemId')
  async removeItem(
    @Param('itemId', uuid) itemId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @MaybeUser() user?: AuthUser,
  ): Promise<Cart> {
    return this.reply(res, await this.carts.removeItem(identityOf(req, user?.id), itemId));
  }

  @Post('coupon')
  @HttpCode(200)
  @ApiOperation({ summary: 'Apply a discount code (validated on every cart read)' })
  @ApiBody({ schema: openApiSchema(CouponSchema) })
  async applyCoupon(
    @Body(new ZodValidationPipe(CouponSchema)) body: z.infer<typeof CouponSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @MaybeUser() user?: AuthUser,
  ): Promise<Cart> {
    return this.reply(res, await this.carts.applyCoupon(identityOf(req, user?.id), body.code));
  }

  @Delete('coupon')
  async removeCoupon(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @MaybeUser() user?: AuthUser,
  ): Promise<Cart> {
    return this.reply(res, await this.carts.removeCoupon(identityOf(req, user?.id)));
  }

  @Delete()
  @ApiOperation({ summary: 'Empty the cart' })
  async clear(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @MaybeUser() user?: AuthUser,
  ): Promise<Cart> {
    return this.reply(res, await this.carts.empty(identityOf(req, user?.id)));
  }
}
