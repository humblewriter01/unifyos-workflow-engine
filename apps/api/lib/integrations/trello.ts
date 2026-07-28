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

export class TrelloService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private async getCredentials(): Promise<{ token: string; key: string }> {
    const appToken = await prisma.appToken.findUnique({
      where: { userId_appName: { userId: this.userId, appName: 'trello' } },
    });
    if (!appToken || !appToken.connected) throw new Error('Trello not connected');
    
    // Trello usually needs an API Key (global) and a User Token (decrypted)
    return {
      token: decrypt(appToken.accessToken),
      key: process.env.TRELLO_API_KEY || '',
    };
  }

  async createCard(listId: string, name: string, desc: string): Promise<any> {
    const { token, key } = await this.getCredentials();
    const response = await fetch(`https://api.trello.com/1/cards?idList=${listId}&name=${encodeURIComponent(name)}&desc=${encodeURIComponent(desc)}&key=${key}&token=${token}`, {
      method: 'POST',
    });
    return response.json();
  }

  async getBoards(): Promise<any[]> {
    const { token, key } = await this.getCredentials();
    const response = await fetch(`https://api.trello.com/1/members/me/boards?key=${key}&token=${token}`);
    return response.json();
  }
}
