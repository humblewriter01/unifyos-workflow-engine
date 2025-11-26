import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Decryption utility
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

export class SlackService {
  private userId: string;
  
  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Get decrypted Slack access token for user
   */
  private async getAccessToken(): Promise<string> {
    const appToken = await prisma.appToken.findUnique({
      where: {
        userId_appName: {
          userId: this.userId,
          appName: 'slack',
        },
      },
    });

    if (!appToken || !appToken.connected) {
      throw new Error('Slack not connected for this user');
    }

    return decrypt(appToken.accessToken);
  }

  /**
   * Send a message to a Slack channel
   */
  async sendMessage(channel: string, text: string, blocks?: any[]): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text,
        blocks,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    // Update last used timestamp
    await prisma.appToken.update({
      where: {
        userId_appName: {
          userId: this.userId,
          appName: 'slack',
        },
      },
      data: {
        lastUsedAt: new Date(),
      },
    });

    return data;
  }

  /**
   * Get list of channels
   */
  async getChannels(): Promise<any[]> {
    const token = await this.getAccessToken();

    const response = await fetch(
      'https://slack.com/api/conversations.list?types=public_channel,private_channel',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data.channels;
  }

  /**
   * Get recent messages from a channel (for notifications)
   */
  async getRecentMessages(channel: string, limit: number = 10): Promise<any[]> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `https://slack.com/api/conversations.history?channel=${channel}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data.messages;
  }

  /**
   * Setup real-time events listener (webhook)
   */
  async subscribeToEvents(eventTypes: string[]): Promise<void> {
    // This would typically be configured in Slack App settings
    // Events are delivered via webhook to /api/slack/events
    console.log(`Subscribing to Slack events: ${eventTypes.join(', ')}`);
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<{ ok: boolean; team: string; user: string }> {
    const token = await this.getAccessToken();

    const response = await fetch('https://slack.com/api/auth.test', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return {
      ok: true,
      team: data.team,
      user: data.user,
    };
  }
}

// Slack webhook event handler
export async function handleSlackEvent(
  userId: string,
  event: any
): Promise<void> {
  // Create notification in unified inbox
  await prisma.notification.create({
    data: {
      userId,
      appName: 'slack',
      appIcon: 'message',
      title: `New message in #${event.channel}`,
      message: event.text || '[No text]',
      priority: event.text?.includes('@channel') ? 'HIGH' : 'MEDIUM',
      metadata: {
        channel: event.channel,
        user: event.user,
        ts: event.ts,
      },
      externalId: event.ts,
    },
  });

  // Check for workflow triggers
  const workflows = await prisma.workflow.findMany({
    where: {
      userId,
      enabled: true,
      triggerApp: 'slack',
      triggerEvent: 'new_message',
    },
  });

  for (const workflow of workflows) {
    // Queue workflow execution
    await prisma.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        status: 'PENDING',
        triggerData: event,
      },
    });
  }
}
