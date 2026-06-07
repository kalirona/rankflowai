// src/types.ts

export enum Role {
  USER = "USER",
  ADMIN = "ADMIN"
}

export enum SubscriptionStatus {
  INACTIVE = "INACTIVE",
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELED = "CANCELED"
}

export enum SyncStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}

export enum CreditType {
  GRANT = "GRANT",
  PURCHASE = "PURCHASE",
  CONSUMPTION = "CONSUMPTION",
  REFUND = "REFUND"
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  passwordHash: string;
  role: Role;
  emailVerified: string | null;
  image: string | null;
  creditBalance: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Account {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationToken {
  identifier: string;
  token: string;
  expires: string;
}

export interface Session {
  id: string;
  sessionToken: string;
  userId: string;
  expires: string;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  credits: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: CreditType;
  description: string | null;
  createdAt: string;
}

export interface Site {
  id: string;
  userId: string;
  url: string;
  wpUsername: string;
  wpAppPasswordEncrypted: string;
  hasWooCommerce: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  siteId: string;
  externalId: number;
  sku: string | null;
  name: string;
  status: string;
  description: string | null;
  shortDescription: string | null;
  originalTitle: string | null;
  originalDescription: string | null;
  originalShortDescription: string | null;
  originalAltText: string | null;
  aiTitleGenerated: string | null;
  aiDescriptionGenerated: string | null;
  aiMetaDescriptionGenerated: string | null;
  syncStatus: SyncStatus;
  isSynced: boolean;
  createdAt: string;
  updatedAt: string;
  seoHistory?: SeoHistory[];
}

export interface SeoHistory {
  id: string;
  productId: string;
  provider: string;
  originalTitle: string | null;
  originalDescription: string | null;
  originalShortDescription: string | null;
  originalAltText: string | null;
  generatedTitle: string | null;
  generatedDescription: string | null;
  generatedMetaDescription: string | null;
  generatedAltText: string | null;
  createdAt: string;
}

export interface Media {
  id: string;
  productId: string;
  externalId: number;
  url: string;
  altText: string | null;
  aiAltTextGenerated: string | null;
  isSynced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiJob {
  id: string;
  userId: string;
  siteId: string;
  status: SyncStatus;
  totalItems: number;
  completedItems: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string | null;
  action: string;
  details: string; // Dynamic JSON string
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface RestorePoint {
  id: string;
  siteId: string;
  resourceId: number;
  title: string;
  description: string | null;
  content: string | null;
  metaFields: string | null; // serialized JSON string
  images: string | null; // serialized JSON string
  timestamp: string;
}

// Auth Request & Response Types
export interface AuthUserResponse {
  id: string;
  name: string | null;
  email: string;
  role: Role;
}

export interface AuthStatusResponse {
  isAuthenticated: boolean;
  user: AuthUserResponse | null;
  subscription: {
    planName: string;
    status: SubscriptionStatus;
    expiresAt: string;
    creditsOwned: number;
  } | null;
}
