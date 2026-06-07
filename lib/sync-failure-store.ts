// lib/sync-failure-store.ts

import fs from "fs";
import path from "path";

const SYNC_FAILURES_FILE_PATH = path.join(process.cwd(), "db_sync_failures.json");

export interface SyncFailureDetail {
  id: string;
  productId: string;
  productName: string;
  siteUrl: string;
  failureReason: string;
  httpStatus: number;
  wpErrorResponse: any;
  timestamp: string;
}

export interface SyncAuditRecord {
  id: string;
  productId: string;
  productName: string;
  siteUrl: string;
  action: "SYNC_START" | "SYNC_SUCCESS" | "SYNC_FAILURE" | "RETRY_ATTEMPT" | "ROLLBACK_SUCCESS" | "ROLLBACK_FAILED";
  details: string;
  timestamp: string;
}

const AUDIT_FILE_PATH = path.join(process.cwd(), "db_sync_audit_history.json");

function loadFailures(): Record<string, SyncFailureDetail> {
  if (fs.existsSync(SYNC_FAILURES_FILE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(SYNC_FAILURES_FILE_PATH, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

function saveFailures(data: Record<string, SyncFailureDetail>) {
  try {
    fs.writeFileSync(SYNC_FAILURES_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write sync failures:", err);
  }
}

function loadAudits(): SyncAuditRecord[] {
  if (fs.existsSync(AUDIT_FILE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(AUDIT_FILE_PATH, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

function saveAudits(data: SyncAuditRecord[]) {
  try {
    fs.writeFileSync(AUDIT_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write sync audits:", err);
  }
}

export const SyncFailureStore = {
  // Save or update failure record
  recordFailure(productId: string, productName: string, siteUrl: string, reason: string, httpStatus: number, wpError: any) {
    const data = loadFailures();
    data[productId] = {
      id: `fail_${Math.random().toString(36).substring(2, 11)}`,
      productId,
      productName,
      siteUrl,
      failureReason: reason,
      httpStatus: httpStatus || 500,
      wpErrorResponse: wpError || { message: reason },
      timestamp: new Date().toISOString()
    };
    saveFailures(data);

    // Append to sync history audit
    this.recordAudit(productId, productName, siteUrl, "SYNC_FAILURE", `Sync failed code ${httpStatus}: ${reason}`);
  },

  // Clear failure on successful sync
  clearFailure(productId: string) {
    const data = loadFailures();
    if (data[productId]) {
      const record = data[productId];
      delete data[productId];
      saveFailures(data);
      this.recordAudit(productId, record.productName, record.siteUrl, "SYNC_SUCCESS", "Successfully synchronized back to WordPress.");
    }
  },

  // Get specific details of a failure
  getFailure(productId: string): SyncFailureDetail | null {
    const data = loadFailures();
    return data[productId] || null;
  },

  // Get all failures for display filter
  getAllFailures(): SyncFailureDetail[] {
    return Object.values(loadFailures());
  },

  // Append audit logging check
  recordAudit(productId: string, productName: string, siteUrl: string, action: SyncAuditRecord["action"], details: string) {
    const audits = loadAudits();
    audits.unshift({
      id: `audit_${Math.random().toString(36).substring(2, 11)}`,
      productId,
      productName,
      siteUrl,
      action,
      details,
      timestamp: new Date().toISOString()
    });
    // Keep max 200 records of audit
    if (audits.length > 200) {
      saveAudits(audits.slice(0, 200));
    } else {
      saveAudits(audits);
    }
  },

  // Retrieve audits list
  getAudits(): SyncAuditRecord[] {
    return loadAudits();
  }
};
