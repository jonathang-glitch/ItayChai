import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { login as loginUser, logout as logoutSession, refresh as refreshSession } from './auth.service';
import { recover as startRecovery, resetPassword } from './recovery.service';
import { acceptInvitation } from '../invitations/invitations.service';
import { parseBody } from '../http/parse-body';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const recoverSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  resetToken: z.string().min(1),
  password: z.string().min(8),
});

const acceptSchema = z.object({
  inviteToken: z.string().min(1),
  password: z.string().min(8),
});

@Controller('api/v1/auth')
export class AuthController {
  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown) {
    const parsed = parseBody(loginSchema, body);
    return loginUser(parsed.email, parsed.password);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: unknown) {
    return refreshSession(parseBody(refreshSchema, body).refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() body: unknown) {
    return logoutSession(parseBody(refreshSchema, body).refreshToken);
  }

  @Post('recover')
  @HttpCode(200)
  recover(@Body() body: unknown) {
    return startRecovery(parseBody(recoverSchema, body).email);
  }

  @Post('reset')
  @HttpCode(200)
  reset(@Body() body: unknown) {
    const parsed = parseBody(resetSchema, body);
    return resetPassword(parsed.resetToken, parsed.password);
  }

  @Post('accept-invite')
  @HttpCode(200)
  acceptInvite(@Body() body: unknown) {
    const parsed = parseBody(acceptSchema, body);
    return acceptInvitation(parsed.inviteToken, parsed.password);
  }
}
