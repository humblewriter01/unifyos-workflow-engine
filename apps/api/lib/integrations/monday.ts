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

export class MondayService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private async getAccessToken(): Promise<string> {
    const appToken = await prisma.appToken.findUnique({
      where: { userId_appName: { userId: this.userId, appName: 'monday' } },
    });
    if (!appToken || !appToken.connected) throw new Error('Monday.com not connected');
    return decrypt(appToken.accessToken);
  }

  async createItem(boardId: number, groupId: string, itemName: string, columnValues?: any): Promise<any> {
    const token = await this.getAccessToken();
    const query = `
      mutation ($boardId: Int!, $groupId: String!, $itemName: String!, $columnValues: JSON) {
        create_item (board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) {
          id
        }
      }
    `;
    
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { boardId, groupId, itemName, columnValues: JSON.stringify(columnValues) },
      }),
    });
    return response.json();
  }
}
