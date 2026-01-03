import { AuditAction, Role } from '@prisma/client';
import { SnaggingMessageRepository } from '../repositories/snagging-message.repository';
import { SnaggingRepository } from '../repositories/snagging.repository';
import { AppError } from '../../../common/errors/AppError';
import { prisma } from '../../../config/database';

// Type for authenticated user from JWT
type AuthUser = { id: string; email: string; role: Role };

export class SnaggingMessageService {
  private messageRepo = new SnaggingMessageRepository();
  private snaggingRepo = new SnaggingRepository();

  // Add a message to snagging thread
  async addMessage(
    user: AuthUser,
    snaggingId: string,
    data: {
      bodyTitle?: string;
      bodyText: string;
      attachments?: Array<{
        url: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
      }>;
    }
  ) {
    const snagging = await this.snaggingRepo.findById(snaggingId);

    if (!snagging) {
      throw new AppError('Snagging thread not found', 404);
    }

    // Authorization: check if user can add messages
    if (user.role === 'OWNER') {
      // Owner can add messages to snaggings they created or units they own
      if (snagging.createdByUserId !== user.id && snagging.unit.ownerId !== user.id) {
        throw new AppError('You do not have permission to add messages to this thread', 403);
      }
    }

    // Create message with attachments
    const message = await this.messageRepo.create({
      snaggingId,
      authorUserId: user.id,
      authorRole: user.role,
      bodyTitle: data.bodyTitle,
      bodyText: data.bodyText,
      attachments: data.attachments
    });

    // Update snagging's updatedAt timestamp
    await this.snaggingRepo.update(snaggingId, {});

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.SNAGGING_MESSAGE_CREATED,
        entityType: 'snagging_message',
        entityId: message.id,
        actorId: user.id,
        metadata: {
          snaggingId,
          messageId: message.id
        }
      }
    });

    return message;
  }

  // Get messages with cursor pagination
  async getMessages(
    user: AuthUser,
    snaggingId: string,
    params: {
      cursor?: string;
      limit?: number;
      direction?: 'forward' | 'backward';
    }
  ) {
    const snagging = await this.snaggingRepo.findById(snaggingId);

    if (!snagging) {
      throw new AppError('Snagging thread not found', 404);
    }

    // Authorization
    if (user.role === 'OWNER') {
      if (snagging.createdByUserId !== user.id && snagging.unit.ownerId !== user.id) {
        throw new AppError('You do not have permission to view this thread', 403);
      }
    }

    const result = await this.messageRepo.findBySnaggingWithCursor({
      snaggingId,
      cursor: params.cursor,
      limit: Number(params.limit) || 20,
      direction: params.direction || 'forward'
    });

    return result;
  }

  // Update a message
  async updateMessage(
    user: AuthUser,
    snaggingId: string,
    messageId: string,
    data: {
      bodyTitle?: string;
      bodyText?: string;
    }
  ) {
    const message = await this.messageRepo.findById(messageId);

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    if (message.snagging.id !== snaggingId) {
      throw new AppError('Message does not belong to this snagging thread', 400);
    }

    // Authorization: only author can edit their own message
    if (message.authorUserId !== user.id) {
      throw new AppError('You can only edit your own messages', 403);
    }

    // Admin cannot edit owner's messages (as per requirements)
    if (user.role === 'ADMIN' && message.authorRole === 'OWNER' && message.authorUserId !== user.id) {
      throw new AppError('Admins cannot edit owner messages', 403);
    }

    const updated = await this.messageRepo.update(messageId, data);

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.SNAGGING_MESSAGE_UPDATED,
        entityType: 'snagging_message',
        entityId: messageId,
        actorId: user.id,
        changes: {
          before: { bodyTitle: message.bodyTitle, bodyText: message.bodyText },
          after: data
        },
        metadata: {
          snaggingId
        }
      }
    });

    return updated;
  }

  // Delete a message (soft delete)
  async deleteMessage(user: AuthUser, snaggingId: string, messageId: string) {
    const message = await this.messageRepo.findById(messageId);

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    if (message.snagging.id !== snaggingId) {
      throw new AppError('Message does not belong to this snagging thread', 400);
    }

    // Authorization
    if (user.role === 'OWNER') {
      // Owner can only delete their own messages
      if (message.authorUserId !== user.id) {
        throw new AppError('You can only delete your own messages', 403);
      }
    }
    // Admin can delete any message

    await this.messageRepo.softDelete(messageId);

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: AuditAction.SNAGGING_MESSAGE_DELETED,
        entityType: 'snagging_message',
        entityId: messageId,
        actorId: user.id,
        metadata: {
          snaggingId,
          authorId: message.authorUserId
        }
      }
    });

    return { message: 'Message deleted successfully' };
  }
}