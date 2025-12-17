import axios from 'axios';
import { serviceConfigs } from '../../config/global.config';

export interface AuditLogEntry {
  action: string;
  details: string;
  data?: Record<string, any>;
  errorMessage?: string;
  errorStack?: string;
  site?: string;
  userId?: string;
  userEmail?: string;
}

/**
 * Service for sending audit logs through the orchestrator
 * Services should not call each other directly - always go through orchestrator
 */
export class AuditLogService {
  private orchestratorUrl: string;

  constructor() {
    this.orchestratorUrl = serviceConfigs.orchestratorUrl;
    console.log('AuditLogService initialized with orchestrator URL:', this.orchestratorUrl);
  }

  /**
   * Log a transcription error to the audit log service via orchestrator
   */
  async logTranscriptionError(
    transcriptId: string,
    errorMessage: string,
    errorStack?: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        action: 'TRANSCRIPTION_ERROR',
        details: `Transcription failed for ID: ${transcriptId}`,
        errorMessage: errorMessage,
        errorStack: errorStack,
        data: {
          transcriptId,
          timestamp: new Date().toISOString(),
          service: 'video-transcription',
          ...additionalData
        },
        site: 'lbt'
      };

      console.log('[AUDIT] Logging transcription error:', {
        transcriptId,
        errorMessage: errorMessage.substring(0, 200) // Truncate for logging
      });

      const response = await axios.post(
        `${this.orchestratorUrl}/auditLogs`,
        auditEntry,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-source-cluster': 'video-transcription-service'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      console.log('[AUDIT] Error logged successfully:', response.status);
    } catch (auditError: any) {
      // Don't let audit logging failure break the main flow
      console.error('[AUDIT] Failed to log error to audit service:', auditError.message);
      // Log locally as fallback
      console.error('[AUDIT] Local fallback log:', {
        transcriptId,
        errorMessage,
        errorStack
      });
    }
  }

  /**
   * Log a transcription success to the audit log service via orchestrator
   */
  async logTranscriptionSuccess(
    transcriptId: string,
    videoTitle: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        action: 'TRANSCRIPTION_COMPLETED',
        details: `Transcription completed for: ${videoTitle}`,
        data: {
          transcriptId,
          videoTitle,
          timestamp: new Date().toISOString(),
          service: 'video-transcription',
          ...additionalData
        },
        site: 'lbt'
      };

      console.log('[AUDIT] Logging transcription success:', transcriptId);

      await axios.post(
        `${this.orchestratorUrl}/auditLogs`,
        auditEntry,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-source-cluster': 'video-transcription-service'
          },
          timeout: 10000
        }
      );

      console.log('[AUDIT] Success logged');
    } catch (auditError: any) {
      console.error('[AUDIT] Failed to log success to audit service:', auditError.message);
    }
  }

  /**
   * Log a generic event to the audit log service via orchestrator
   */
  async logEvent(
    action: string,
    details: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        action,
        details,
        data: {
          timestamp: new Date().toISOString(),
          service: 'video-transcription',
          ...data
        },
        site: 'lbt'
      };

      await axios.post(
        `${this.orchestratorUrl}/auditLogs`,
        auditEntry,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-source-cluster': 'video-transcription-service'
          },
          timeout: 10000
        }
      );
    } catch (auditError: any) {
      console.error('[AUDIT] Failed to log event:', auditError.message);
    }
  }
}

// Singleton instance
export const auditLogService = new AuditLogService();
