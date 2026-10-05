import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { JSONWebKeySet } from 'jose';
import { SigningKeys } from './signing-keys.js';

/** Public keys for verifying access tokens (consumed by the gateway and every service). */
@ApiExcludeController()
@Controller('.well-known')
export class JwksController {
  constructor(private readonly keys: SigningKeys) {}

  @Get('jwks.json')
  @Header('cache-control', 'public, max-age=300')
  jwks(): JSONWebKeySet {
    return this.keys.jwks;
  }
}
