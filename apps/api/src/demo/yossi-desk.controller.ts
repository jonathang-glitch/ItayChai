import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Header, NotFoundException, Param, Post } from '@nestjs/common';
import { DEV_TENANT_ID, WHATSAPP_PROVIDER } from '@itay-chai/contracts';
import { prisma } from '@itay-chai/database';
import { handleWhatsAppInbound } from '../webhooks/whatsapp/handle-inbound';

const PEOPLE = {
  noa: { id: '00000000-0000-4000-8000-000000000011', name: 'נועה', role: 'בעלת הבית' },
  dana: { id: '00000000-0000-4000-8000-000000000016', name: 'דנה', role: 'עובדת' },
  yossi: { id: '00000000-0000-4000-8000-000000000017', name: 'יוסי', role: 'עובד' },
} as const;

type Who = keyof typeof PEOPLE;

function devOnly() {
  if (process.env.NODE_ENV === 'production') {
    throw new NotFoundException();
  }
}

function person(who: string) {
  if (who in PEOPLE) {
    return PEOPLE[who as Who];
  }
  throw new NotFoundException();
}

@Controller()
export class YossiDeskController {
  @Get(['desk', 'yossi'])
  @Header('Content-Type', 'text/html; charset=utf-8')
  page() {
    devOnly();
    return PAGE;
  }

  @Get('yossi/messages')
  yossiMessages() {
    return this.messages('yossi');
  }

  @Post('yossi/reply')
  yossiReply(@Body() body: { text?: string }) {
    return this.reply('yossi', body);
  }

  @Get('desk/:who/messages')
  async messages(@Param('who') who: string) {
    devOnly();
    const user = person(who);
    const desk = `notice:${user.id}:desk`;
    const rows = await prisma.message.findMany({
      where: {
        tenantId: DEV_TENANT_ID,
        OR: [
          { direction: 'OUTBOUND', session: { customerUserId: user.id } },
          { direction: 'INBOUND', session: { customerUserId: user.id, externalMessageId: desk } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 80,
      select: { id: true, direction: true, body: true, createdAt: true },
    });
    return { messages: rows };
  }

  @Post('desk/:who/reply')
  async reply(@Param('who') who: string, @Body() body: { text?: string }) {
    devOnly();
    const user = person(who);
    const text = body.text?.trim() ?? '';
    if (!text) {
      return { ok: false, error: 'empty' };
    }
    const identity = await prisma.stakeholderIdentity.findFirst({
      where: { tenantId: DEV_TENANT_ID, userId: user.id, channel: WHATSAPP_PROVIDER },
      select: { externalId: true },
    });
    if (!identity) {
      return { ok: false, error: 'no_phone' };
    }
    const desk = `notice:${user.id}:desk`;
    const session = await prisma.agentSession.upsert({
      where: { tenantId_externalMessageId: { tenantId: DEV_TENANT_ID, externalMessageId: desk } },
      create: {
        tenantId: DEV_TENANT_ID,
        customerUserId: user.id,
        externalMessageId: desk,
        status: 'COMPLETED',
      },
      update: {},
      select: { id: true },
    });
    await prisma.message.create({
      data: {
        tenantId: DEV_TENANT_ID,
        sessionId: session.id,
        direction: 'INBOUND',
        channel: WHATSAPP_PROVIDER,
        body: text,
      },
    });
    const from = identity.externalId.startsWith('whatsapp:')
      ? identity.externalId
      : `whatsapp:${identity.externalId}`;
    return handleWhatsAppInbound({
      MessageSid: `local-${who}-${randomUUID()}`,
      From: from,
      To: 'whatsapp:+14155238886',
      Body: text,
    });
  }
}

const PAGE = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>דנה · יוסי · נועה</title>
<style>
  body { margin: 0; background: #0b141a; font-family: system-ui, sans-serif; }
  .row { display: flex; gap: 16px; height: 100vh; padding: 16px; box-sizing: border-box; }
  .phone { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #efeae2; border-radius: 16px; overflow: hidden; }
  header { background: #075e54; color: #fff; padding: 14px 16px; font-weight: 600; }
  header small { display: block; font-weight: 400; opacity: .8; font-size: 12px; }
  ol { list-style: none; margin: 0; padding: 12px; flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
  li { max-width: 80%; padding: 8px 10px; border-radius: 8px; white-space: pre-wrap; line-height: 1.35; color: #111; }
  li.theirs { background: #fff; align-self: flex-start; }
  li.mine { background: #d9fdd3; align-self: flex-end; }
  time { display: block; color: #667; font-size: 11px; margin-top: 4px; }
  form { display: flex; gap: 8px; padding: 10px; background: #f0f2f5; }
  input { flex: 1; min-width: 0; border: 0; border-radius: 18px; padding: 10px 14px; font: inherit; }
  button { border: 0; border-radius: 18px; background: #075e54; color: #fff; padding: 0 16px; font: inherit; }
</style>
</head>
<body>
  <div class="row">
    <section class="phone" data-who="dana">
      <header>דנה<small>וואטסאפ</small></header>
      <ol></ol>
      <form><input autocomplete="off" placeholder="הודעה" /><button type="submit">שלח</button></form>
    </section>
    <section class="phone" data-who="yossi">
      <header>יוסי<small>וואטסאפ</small></header>
      <ol></ol>
      <form><input autocomplete="off" placeholder="הודעה" /><button type="submit">שלח</button></form>
    </section>
    <section class="phone" data-who="noa">
      <header>נועה<small>בעלת הבית</small></header>
      <ol></ol>
      <form><input autocomplete="off" placeholder="הודעה" /><button type="submit">שלח</button></form>
    </section>
  </div>
  <script>
    function wire(phone) {
      const who = phone.dataset.who;
      const log = phone.querySelector('ol');
      const text = phone.querySelector('input');
      async function paint() {
        const res = await fetch('/desk/' + who + '/messages');
        const data = await res.json();
        const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
        log.innerHTML = '';
        for (const message of data.messages || []) {
          const item = document.createElement('li');
          item.className = message.direction === 'INBOUND' ? 'mine' : 'theirs';
          item.textContent = message.body;
          const time = document.createElement('time');
          time.textContent = new Date(message.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
          item.appendChild(time);
          log.appendChild(item);
        }
        if (atBottom) log.scrollTop = log.scrollHeight;
      }
      phone.querySelector('form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const value = text.value.trim();
        if (!value) return;
        text.value = '';
        await fetch('/desk/' + who + '/reply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: value }) });
        await paint();
      });
      paint();
      setInterval(paint, 2000);
    }
    for (const phone of document.querySelectorAll('.phone')) wire(phone);
  </script>
</body>
</html>`;
