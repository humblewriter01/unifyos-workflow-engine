import prisma from './prisma';
import { decryptToken } from './oauth';

export async function getUserAppToken(userId: string, appName: string) {
  const record = await prisma.appToken.findUnique({
    where: { userId_appName: { userId, appName: appName.toLowerCase() } },
    select: { id: true, accessToken: true, refreshToken: true, expiresAt: true, scope: true, metadata: true, connected: true },
  });
  if (!record?.connected) return null;
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) return null;
  const accessToken = decryptToken(record.accessToken);
  if (!accessToken) return null;
  return { ...record, accessToken };
}

export async function markAppTokenUsed(id: string) {
  await prisma.appToken.update({ where: { id }, data: { lastUsedAt: new Date() } });
}
