import { getActiveEmailAccountsForSync } from "../email-account.service.js";
import { syncEmailAccount } from "../imap/imap-sync.service.js";
import { env } from "../../../config/env.js";

/**
 * Email Sync Worker
 * Background service for periodic email synchronization
 */

const SYNC_INTERVAL = env.EMAIL_SYNC_INTERVAL || 5 * 60 * 1000; // Default: 5 minutes
const SYNC_BATCH_SIZE = env.EMAIL_SYNC_BATCH_SIZE || 10;

let isRunning = false;
let intervalId = null;
let workerStats = {
  totalSyncs: 0,
  successfulSyncs: 0,
  failedSyncs: 0,
  lastSyncTime: null,
  startTime: null
};

/**
 * Sync a single email account
 */
async function syncAccount(account) {
  try {
    console.log(`[Email Sync] Syncing account: ${account.email} (${account.provider})`);
    
    const result = await syncEmailAccount(account, {
      folder: "INBOX",
      limit: SYNC_BATCH_SIZE,
      since: account.lastSyncedAt
    });
    
    workerStats.totalSyncs++;
    
    if (result.success) {
      workerStats.successfulSyncs++;
      console.log(`[Email Sync] ✓ Synced ${account.email}: ${result.processed} processed, ${result.skipped} skipped`);
    } else {
      workerStats.failedSyncs++;
      console.error(`[Email Sync] ✗ Failed to sync ${account.email}: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    workerStats.failedSyncs++;
    console.error(`[Email Sync] Error syncing account ${account.email}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Run sync cycle for all active accounts
 */
async function runSyncCycle() {
  if (isRunning) {
    console.log("[Email Sync] Sync cycle already in progress, skipping");
    return;
  }
  
  isRunning = true;
  workerStats.lastSyncTime = new Date();
  
  try {
    console.log("[Email Sync] Starting sync cycle...");
    
    const accounts = await getActiveEmailAccountsForSync();
    
    if (accounts.length === 0) {
      console.log("[Email Sync] No active email accounts to sync");
      return;
    }
    
    console.log(`[Email Sync] Found ${accounts.length} active email accounts`);
    
    // Sync accounts sequentially to avoid overwhelming the system
    for (const account of accounts) {
      await syncAccount(account);
      
      // Small delay between accounts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log("[Email Sync] Sync cycle completed");
  } catch (error) {
    console.error("[Email Sync] Sync cycle error:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the email sync worker
 */
export function startEmailSyncWorker() {
  if (intervalId) {
    console.log("[Email Sync] Worker already running");
    return;
  }
  
  workerStats.startTime = new Date();
  
  console.log(`[Email Sync] Starting worker with ${SYNC_INTERVAL / 1000}s interval`);
  
  // Run initial sync
  runSyncCycle();
  
  // Set up periodic sync
  intervalId = setInterval(runSyncCycle, SYNC_INTERVAL);
  
  return {
    started: true,
    interval: SYNC_INTERVAL
  };
}

/**
 * Stop the email sync worker
 */
export function stopEmailSyncWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[Email Sync] Worker stopped");
    return { stopped: true };
  }
  
  return { stopped: false, message: "Worker was not running" };
}

/**
 * Get worker statistics
 */
export function getWorkerStats() {
  return {
    ...workerStats,
    isRunning,
    uptime: workerStats.startTime ? Date.now() - workerStats.startTime.getTime() : 0,
    interval: SYNC_INTERVAL
  };
}

/**
 * Trigger manual sync for all accounts
 */
export async function triggerManualSync() {
  console.log("[Email Sync] Manual sync triggered");
  return runSyncCycle();
}

/**
 * Trigger manual sync for a specific account
 */
export async function triggerAccountSync(accountId) {
  const { getActiveEmailAccountsForSync } = await import("../email-account.service.js");
  const accounts = await getActiveEmailAccountsForSync();
  
  const account = accounts.find(a => a.id === accountId);
  
  if (!account) {
    throw new Error("Account not found or not active");
  }
  
  return syncAccount(account);
}

// Export for testing
export { runSyncCycle, syncAccount };
