import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function decrypt(encryptedText: string): string {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export class AsanaService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private async getAccessToken(): Promise<string> {
    const appToken = await prisma.appToken.findUnique({
      where: { userId_appName: { userId: this.userId, appName: 'asana' } },
    });
    if (!appToken || !appToken.connected) throw new Error('Asana not connected');
    return decrypt(appToken.accessToken);
  }

  async createTask(workspaceId: string, projectId: string, name: string, notes: string): Promise<any> {
    const token = await this.getAccessToken();
    const response = await fetch('https://app.asana.com/api/1.0/tasks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          workspace: workspaceId,
          projects: [projectId],
          name,
          notes,
        },
      }),
    });
    return response.json();
  }
}
