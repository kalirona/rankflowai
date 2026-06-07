// server/db.ts
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { 
  User, Session, Account, Plan, Subscription, CreditTransaction, 
  Site, Product, Media, AiJob, ActivityLog, Role, SubscriptionStatus, CreditType, SyncStatus, SeoHistory,
  RestorePoint
} from "../src/types";

const DB_FILE_PATH = path.join(process.cwd(), "db_store.json");

// Multi-mode database engine initialization
const isPrismaActive = !!process.env.DATABASE_URL;

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/rankflow?schema=public"
    }
  }
});

interface DbStructure {
  users: User[];
  sessions: Session[];
  accounts: Account[];
  plans: Plan[];
  subscriptions: Subscription[];
  creditTransactions: CreditTransaction[];
  sites: Site[];
  products: Product[];
  media: Media[];
  aiJobs: AiJob[];
  activityLogs: ActivityLog[];
  seoHistories: SeoHistory[];
  processedTransactions: string[];
  restorePoints: RestorePoint[];
}

const DEFAULT_PLANS: Plan[] = [
  {
    id: "plan-free",
    name: "Free Trial",
    description: "Connect 1 site, parse up to 50 products. 100 welcome credits.",
    price: 0,
    credits: 100,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "plan-starter-monthly",
    name: "Starter Monthly",
    description: "Optimize up to 5 WooCommerce sites. 200 monthly credits.",
    price: 19,
    credits: 200,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "plan-starter-annual",
    name: "Starter Annual",
    description: "Optimize up to 5 WooCommerce sites. 3,000 annual credits.",
    price: 149,
    credits: 3000,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "plan-pro-monthly",
    name: "Pro Monthly",
    description: "Connect up to 15 sites, unlimited products, with 1,000 monthly credits.",
    price: 49,
    credits: 1000,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "plan-pro-annual",
    name: "Pro Annual",
    description: "Connect up to 15 sites, unlimited products, with 15,000 annual credits.",
    price: 399,
    credits: 15000,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "plan-agency-monthly",
    name: "Agency Monthly",
    description: "Unlimited sites & products, 5,000 monthly credits, Dedicated queue.",
    price: 149,
    credits: 5000,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "plan-agency-annual",
    name: "Agency Annual",
    description: "Unlimited sites & products, 75,000 annual credits, dedicated queue.",
    price: 1199,
    credits: 75000,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

function initDb(): DbStructure {
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const rawData = fs.readFileSync(DB_FILE_PATH, "utf-8");
      const parsed = JSON.parse(rawData) as DbStructure;
      return {
        users: parsed.users || [],
        sessions: parsed.sessions || [],
        accounts: parsed.accounts || [],
        plans: parsed.plans && parsed.plans.length > 0 ? parsed.plans : DEFAULT_PLANS,
        subscriptions: parsed.subscriptions || [],
        creditTransactions: parsed.creditTransactions || [],
        sites: parsed.sites || [],
        products: parsed.products || [],
        media: parsed.media || [],
        aiJobs: parsed.aiJobs || [],
        activityLogs: parsed.activityLogs || [],
        seoHistories: parsed.seoHistories || [],
        processedTransactions: parsed.processedTransactions || [],
        restorePoints: parsed.restorePoints || []
      };
    } catch (e) {
      console.error("Failed to read database store, resetting database...", e);
    }
  }

  const initial: DbStructure = {
    users: [],
    sessions: [],
    accounts: [],
    plans: DEFAULT_PLANS,
    subscriptions: [],
    creditTransactions: [],
    sites: [],
    products: [],
    media: [],
    aiJobs: [],
    activityLogs: [],
    seoHistories: [],
    processedTransactions: [],
    restorePoints: []
  };
  saveDb(initial);
  return initial;
}

function saveDb(data: DbStructure) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write to database store:", e);
  }
}

// Plan UUID standard mappings for core Postgres database fields
function mapPlanIdToUuid(planId: string): string {
  if (planId === "plan-free") return "00000000-0000-0000-0000-000000000001";
  if (planId === "plan-growth") return "00000000-0000-0000-0000-000000000002";
  if (planId === "plan-scale") return "00000000-0000-0000-0000-000000000003";
  if (planId === "plan-starter-monthly") return "00000000-0000-0000-0000-000000000010";
  if (planId === "plan-starter-annual") return "00000000-0000-0000-0000-000000000011";
  if (planId === "plan-pro-monthly") return "00000000-0000-0000-0000-000000000020";
  if (planId === "plan-pro-annual") return "00000000-0000-0000-0000-000000000021";
  if (planId === "plan-agency-monthly") return "00000000-0000-0000-0000-000000000030";
  if (planId === "plan-agency-annual") return "00000000-0000-0000-0000-000000000031";
  return planId;
}

function mapUuidToPlanId(uuid: string): string {
  if (uuid === "00000000-0000-0000-0000-000000000001") return "plan-free";
  if (uuid === "00000000-0000-0000-0000-000000000002") return "plan-growth";
  if (uuid === "00000000-0000-0000-0000-000000000003") return "plan-scale";
  if (uuid === "00000000-0000-0000-0000-000000000010") return "plan-starter-monthly";
  if (uuid === "00000000-0000-0000-0000-000000000011") return "plan-starter-annual";
  if (uuid === "00000000-0000-0000-0000-000000000020") return "plan-pro-monthly";
  if (uuid === "00000000-0000-0000-0000-000000000021") return "plan-pro-annual";
  if (uuid === "00000000-0000-0000-0000-000000000030") return "plan-agency-monthly";
  if (uuid === "00000000-0000-0000-0000-000000000031") return "plan-agency-annual";
  return uuid;
}

// System DB Bootstrap to register target plan dimensions
export async function bootstrapDb() {
  if (!isPrismaActive) return;
  try {
    const plansToSetup = [
      {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Free Trial",
        description: "Connect 1 site, parse up to 50 products.",
        price: 0,
        credits: 100,
        isActive: true,
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        name: "Growth Professional",
        description: "Connect up to 5 sites, unlimited products, 1,000 monthly credits.",
        price: 49,
        credits: 1000,
        isActive: true,
      },
      {
        id: "00000000-0000-0000-0000-000000000003",
        name: "Enterprise Scale",
        description: "Unlimited sites & products, 5,000 credits, Dedicated Gemini throughput.",
        price: 149,
        credits: 5000,
        isActive: true,
      },
      {
        id: "00000000-0000-0000-0000-000000000010",
        name: "Starter Monthly",
        description: "Optimize up to 5 WooCommerce sites. 200 monthly credits.",
        price: 19,
        credits: 200,
        isActive: true,
      },
      {
        id: "00000000-0000-0000-0000-000000000011",
        name: "Starter Annual",
        description: "Optimize up to 5 WooCommerce sites. 3,000 annual credits.",
        price: 149,
        credits: 3000,
        isActive: true,
      },
      {
        id: "00000000-0000-0000-0000-000000000020",
        name: "Pro Monthly",
        description: "Connect up to 15 sites, unlimited products, with 1,000 monthly credits.",
        price: 49,
        credits: 1000,
        isActive: true,
      },
      {
        id: "00000000-0000-0000-0000-000000000021",
        name: "Pro Annual",
        description: "Connect up to 15 sites, unlimited products, with 15,000 annual credits.",
        price: 399,
        credits: 15000,
        isActive: true,
      },
      {
        id: "00000000-0000-0000-0000-000000000030",
        name: "Agency Monthly",
        description: "Unlimited sites & products, 5,000 monthly credits, Dedicated queue.",
        price: 149,
        credits: 5000,
        isActive: true,
      },
      {
        id: "00000000-0000-0000-0000-000000000031",
        name: "Agency Annual",
        description: "Unlimited sites & products, 75,000 annual credits, dedicated queue.",
        price: 1199,
        credits: 75000,
        isActive: true,
      }
    ];

    for (const plan of plansToSetup) {
      await prisma.plan.upsert({
        where: { id: plan.id },
        update: {
          name: plan.name,
          description: plan.description,
          price: plan.price,
          credits: plan.credits,
          isActive: plan.isActive,
        },
        create: {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          price: plan.price,
          credits: plan.credits,
          isActive: plan.isActive,
        }
      });
    }
    console.log("PostgreSQL Database schema successfully initialized with pricing tier metadata.");
  } catch (error) {
    console.warn("Could not seed Postgres metadata plan rows during initial start:", error);
  }
}

// Immediately attempt DB bootstrap
bootstrapDb();

// Globally accessible in-memory reservation registry that persists
const creditReservationsRegistry = new Map<string, {
  id: string;
  userId: string;
  amount: number;
  description: string;
  createdAt: string;
}>();

export const DbEngine = {
  // --- USERS ---
  async getUserByEmail(email: string): Promise<User | undefined> {
    if (isPrismaActive) {
      try {
        const u = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" }, deletedAt: null }
        });
        if (!u) return undefined;
        return {
          ...u,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
          deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
          emailVerified: u.emailVerified ? u.emailVerified.toISOString() : null,
        } as any;
      } catch (err) {
        console.error("Prisma error pulling user by email:", err);
      }
    }
    const activeDb = initDb();
    return activeDb.users.find(u => u.email.toLowerCase() === email.toLowerCase() && !u.deletedAt);
  },

  async getUserById(id: string): Promise<User | undefined> {
    if (isPrismaActive) {
      try {
        const u = await prisma.user.findUnique({
          where: { id }
        });
        if (!u || u.deletedAt) return undefined;
        return {
          ...u,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
          deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
          emailVerified: u.emailVerified ? u.emailVerified.toISOString() : null,
        } as any;
      } catch (err) {
        console.error("Prisma error pulling user by id:", err);
      }
    }
    const activeDb = initDb();
    return activeDb.users.find(u => u.id === id && !u.deletedAt);
  },

  async createUser(user: Omit<User, "id" | "creditBalance" | "createdAt" | "updatedAt" | "deletedAt">): Promise<User> {
    if (isPrismaActive) {
      try {
        return await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: user.email,
              name: user.name,
              passwordHash: user.passwordHash,
              role: user.role as any,
              creditBalance: 100, // Grant default welcome credits
            }
          });

          // Establish Free Subscription tier
          await tx.subscription.create({
            data: {
              userId: newUser.id,
              planId: "00000000-0000-0000-0000-000000000001", // plan-free
              status: "ACTIVE",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              stripeSubscriptionId: `sub_stripe_${Math.random().toString(36).substring(2, 8)}`,
            }
          });

          // Document grant in credit records
          await tx.creditTransaction.create({
            data: {
              userId: newUser.id,
              amount: 100,
              type: "GRANT",
              description: "Welcome bonus credits",
            }
          });

          return {
            ...newUser,
            createdAt: newUser.createdAt.toISOString(),
            updatedAt: newUser.updatedAt.toISOString(),
            deletedAt: null,
            emailVerified: null,
          } as any;
        });
      } catch (err) {
        console.error("Prisma transactional registration aborted:", err);
        throw err;
      }
    }

    const activeDb = initDb();
    const newUser: User = {
      ...user,
      id: `usr_${Math.random().toString(36).substring(2, 11)}`,
      creditBalance: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null
    };
    activeDb.users.push(newUser);
    saveDb(activeDb);

    // Bootstrap free settings
    await this.createSubscription(newUser.id, "plan-free");
    await this.createCreditTransaction(newUser.id, 100, CreditType.GRANT, "Welcome bonus credits");

    return newUser;
  },

  // --- SESSIONS ---
  async createSession(userId: string, token: string, expires: Date): Promise<Session> {
    if (isPrismaActive) {
      try {
        const s = await prisma.session.create({
          data: {
            userId,
            sessionToken: token,
            expires,
          }
        });
        return {
          ...s,
          expires: s.expires.toISOString(),
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        } as any;
      } catch (err) {
        console.error("Session persistent generation failed:", err);
      }
    }
    const activeDb = initDb();
    const newSession: Session = {
      id: `sess_${Math.random().toString(36).substring(2, 11)}`,
      sessionToken: token,
      userId,
      expires: expires.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    activeDb.sessions.push(newSession);
    saveDb(activeDb);
    return newSession;
  },

  async getSessionByToken(token: string): Promise<Session | undefined> {
    if (isPrismaActive) {
      try {
        const s = await prisma.session.findUnique({
          where: { sessionToken: token }
        });
        if (s && s.expires > new Date()) {
          return {
            ...s,
            expires: s.expires.toISOString(),
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
          } as any;
        }
        return undefined;
      } catch (err) {
        console.error("Session verification failed:", err);
      }
    }
    const activeDb = initDb();
    const sess = activeDb.sessions.find(s => s.sessionToken === token);
    if (sess && new Date(sess.expires) > new Date()) {
      return sess;
    }
    return undefined;
  },

  async deleteSession(token: string): Promise<void> {
    if (isPrismaActive) {
      try {
        await prisma.session.delete({
          where: { sessionToken: token }
        });
      } catch {
        // Suppress missing keys on clean signout
      }
      return;
    }
    const activeDb = initDb();
    activeDb.sessions = activeDb.sessions.filter(s => s.sessionToken !== token);
    saveDb(activeDb);
  },

  // --- PLANS & SUBSCRIPTIONS ---
  async getPlans(): Promise<Plan[]> {
    if (isPrismaActive) {
      try {
        const plans = await prisma.plan.findMany();
        return plans.map(p => ({
          ...p,
          id: mapUuidToPlanId(p.id),
          price: Number(p.price),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })) as any;
      } catch (err) {
        console.error("Plan pulling failed:", err);
      }
    }
    const activeDb = initDb();
    return activeDb.plans;
  },

  async getSubscriptionForUser(userId: string): Promise<{ subscription: Subscription & { plan: Plan }; creditsOwned: number; creditsAvailable: number; creditsReserved: number }> {
    if (isPrismaActive) {
      try {
        let sub = await prisma.subscription.findFirst({
          where: { userId, status: "ACTIVE" },
          include: { plan: true }
        });

        if (!sub) {
          sub = await prisma.subscription.create({
            data: {
              userId,
              planId: "00000000-0000-0000-0000-000000000001",
              status: "ACTIVE",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              stripeSubscriptionId: `sub_stripe_${Math.random().toString(36).substring(2, 8)}`,
            },
            include: { plan: true }
          });
        }

        const user = await prisma.user.findUnique({
          where: { id: userId }
        });
        const creditsOwned = user ? user.creditBalance : 100;
        const creditsReserved = this.getReservedCreditsCountForUser(userId);
        const creditsAvailable = Math.max(0, creditsOwned - creditsReserved);

        return {
          subscription: {
            id: sub.id,
            userId: sub.userId,
            planId: mapUuidToPlanId(sub.planId),
            status: sub.status as any,
            currentPeriodStart: sub.currentPeriodStart.toISOString(),
            currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
            stripeSubscriptionId: sub.stripeSubscriptionId,
            createdAt: sub.createdAt.toISOString(),
            updatedAt: sub.updatedAt.toISOString(),
            plan: {
              id: mapUuidToPlanId(sub.plan.id),
              name: sub.plan.name,
              description: sub.plan.description,
              price: Number(sub.plan.price),
              credits: sub.plan.credits,
              isActive: sub.plan.isActive,
              createdAt: sub.plan.createdAt.toISOString(),
              updatedAt: sub.plan.updatedAt.toISOString(),
            }
          },
          creditsOwned,
          creditsAvailable,
          creditsReserved
        };
      } catch (err) {
        console.error("Prisma active plan lookup failure:", err);
      }
    }

    const activeDb = initDb();
    let sub = activeDb.subscriptions.find(s => s.userId === userId && s.status === SubscriptionStatus.ACTIVE);
    if (!sub) {
      sub = await this.createSubscription(userId, "plan-free");
    }
    const plan = activeDb.plans.find(p => p.id === sub!.planId) || DEFAULT_PLANS[0];
    const user = activeDb.users.find(u => u.id === userId);
    const creditsOwned = user && user.creditBalance !== undefined 
      ? user.creditBalance 
      : activeDb.creditTransactions
          .filter(t => t.userId === userId)
          .reduce((sum, current) => sum + current.amount, 0);

    const creditsReserved = this.getReservedCreditsCountForUser(userId);
    const creditsAvailable = Math.max(0, creditsOwned - creditsReserved);

    return {
      subscription: {
        ...sub!,
        plan
      },
      creditsOwned,
      creditsAvailable,
      creditsReserved
    };
  },

  async createSubscription(userId: string, planId: string): Promise<Subscription> {
    if (isPrismaActive) {
      try {
        const dbPlanId = mapPlanIdToUuid(planId);
        return await prisma.$transaction(async (tx) => {
          await tx.subscription.updateMany({
            where: { userId, status: "ACTIVE" },
            data: { status: "CANCELED" }
          });

          const newSub = await tx.subscription.create({
            data: {
              userId,
              planId: dbPlanId,
              status: "ACTIVE",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              stripeSubscriptionId: `sub_stripe_${Math.random().toString(36).substring(2, 8)}`,
            }
          });

          return {
            ...newSub,
            planId: mapUuidToPlanId(newSub.planId),
            status: newSub.status as any,
            currentPeriodStart: newSub.currentPeriodStart.toISOString(),
            currentPeriodEnd: newSub.currentPeriodEnd.toISOString(),
            createdAt: newSub.createdAt.toISOString(),
            updatedAt: newSub.updatedAt.toISOString(),
          } as any;
        });
      } catch (err) {
        console.error("Subscription transaction failures:", err);
        throw err;
      }
    }

    const activeDb = initDb();
    const plan = activeDb.plans.find(p => p.id === planId) || DEFAULT_PLANS[0];
    
    activeDb.subscriptions = activeDb.subscriptions.map(s => {
      if (s.userId === userId && s.status === SubscriptionStatus.ACTIVE) {
        return {
          ...s,
          status: SubscriptionStatus.CANCELED,
          updatedAt: new Date().toISOString()
        };
      }
      return s;
    });

    const newSub: Subscription = {
      id: `sub_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      stripeSubscriptionId: `sub_stripe_${Math.random().toString(36).substring(2, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    activeDb.subscriptions.push(newSub);
    saveDb(activeDb);
    return newSub;
  },

  // --- CREDITS WITH ATOMIC UPDATES ---
  async createCreditTransaction(
    userId: string, 
    amount: number, 
    type: CreditType, 
    description: string
  ): Promise<CreditTransaction> {
    if (isPrismaActive) {
      try {
        return await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId }
          });
          if (!user) throw new Error("Target account does not exist.");

          const newBalance = user.creditBalance + amount;
          if (amount < 0 && newBalance < 0) {
            throw new Error(`Insufficient credit balance. Operation requires ${Math.abs(amount)} credits, but you only possess ${user.creditBalance} credits.`);
          }

          // Atomically update user balance
          await tx.user.update({
            where: { id: userId },
            data: { creditBalance: newBalance }
          });

          // Document in transaction logs
          const ct = await tx.creditTransaction.create({
            data: {
              userId,
              amount,
              type: type as any,
              description
            }
          });

          return {
            ...ct,
            createdAt: ct.createdAt.toISOString()
          } as any;
        });
      } catch (err) {
        console.error("Credit balance transaction fails:", err);
        throw err;
      }
    }

    const activeDb = initDb();
    const userIndex = activeDb.users.findIndex(u => u.id === userId);
    if (userIndex === -1) throw new Error("Target account does not exist.");

    const user = activeDb.users[userIndex];
    if (user.creditBalance === undefined) user.creditBalance = 100;

    const newBalance = user.creditBalance + amount;
    if (amount < 0 && newBalance < 0) {
      throw new Error(`Insufficient credit balance. Operation requires ${Math.abs(amount)} credits, but you only possess ${user.creditBalance} credits.`);
    }

    user.creditBalance = newBalance;
    user.updatedAt = new Date().toISOString();

    const transaction: CreditTransaction = {
      id: `tx_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      amount,
      type,
      description,
      createdAt: new Date().toISOString()
    };
    activeDb.creditTransactions.push(transaction);
    saveDb(activeDb);
    return transaction;
  },

  async getCreditTransactions(userId: string): Promise<CreditTransaction[]> {
    if (isPrismaActive) {
      try {
        const txs = await prisma.creditTransaction.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" }
        });
        return txs.map(t => ({
          ...t,
          type: t.type as any,
          createdAt: t.createdAt.toISOString()
        }));
      } catch (err) {
        console.error("Prisma error pulling transactions for user:", err);
        return [];
      }
    }
    const activeDb = initDb();
    return activeDb.creditTransactions
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  getReservedCreditsCountForUser(userId: string): number {
    let sum = 0;
    for (const res of creditReservationsRegistry.values()) {
      if (res.userId === userId) {
        sum += res.amount;
      }
    }
    return sum;
  },

  async reserveCredits(userId: string, amount: number, description: string): Promise<string> {
    const rawBalance = await this.getUserCreditBalance(userId);
    const reservedSum = this.getReservedCreditsCountForUser(userId);
    const available = rawBalance - reservedSum;

    if (available < amount) {
      throw new Error(`Insufficient available credit balance. Action requires ${amount} credits. Currently: ${rawBalance} total, ${reservedSum} reserved, leaving ${available} available.`);
    }

    const reservationId = `res_${Math.random().toString(36).substring(2, 11)}`;
    creditReservationsRegistry.set(reservationId, {
      id: reservationId,
      userId,
      amount,
      description,
      createdAt: new Date().toISOString()
    });

    console.log(`[CreditReservation] Reserved ${amount} credits for user ${userId} under ID ${reservationId}`);
    return reservationId;
  },

  async commitReservedCredits(reservationId: string): Promise<boolean> {
    const res = creditReservationsRegistry.get(reservationId);
    if (!res) {
      console.warn(`[CreditReservation] Reservation ID ${reservationId} not found during commit.`);
      return false;
    }

    // Permanently deduct by recording the transaction
    await this.createCreditTransaction(
      res.userId,
      -res.amount,
      CreditType.CONSUMPTION,
      res.description
    );

    creditReservationsRegistry.delete(reservationId);
    console.log(`[CreditReservation] Committed reservation ID ${reservationId}. Balance successfully deducted permanently.`);
    return true;
  },

  async refundReservedCredits(reservationId: string): Promise<boolean> {
    const res = creditReservationsRegistry.get(reservationId);
    if (!res) {
      console.warn(`[CreditReservation] Reservation ID ${reservationId} not found during refund release.`);
      return false;
    }

    // Merely delete from reservation pool to release/refund held credits immediately
    creditReservationsRegistry.delete(reservationId);
    console.log(`[CreditReservation] Released reservation ID ${reservationId}. Held credits returned to available pool.`);
    return true;
  },

  async getUserCreditBalance(userId: string): Promise<number> {
    if (isPrismaActive) {
      try {
        const u = await prisma.user.findUnique({ where: { id: userId } });
        return u ? u.creditBalance : 100;
      } catch {
        return 100;
      }
    }
    const activeDb = initDb();
    const u = activeDb.users.find(x => x.id === userId);
    return u && u.creditBalance !== undefined ? u.creditBalance : 100;
  },

  // --- REPLAY PROTECTION & STRIPE WEBHOOK COMPLIANCE ---
  async checkCompletedTransaction(transactionId: string): Promise<boolean> {
    if (isPrismaActive) {
      try {
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: transactionId }
        });
        return !!sub;
      } catch {
        return false;
      }
    }
    const activeDb = initDb();
    return activeDb.processedTransactions.includes(transactionId);
  },

  async registerProcessedTransaction(transactionId: string): Promise<void> {
    if (isPrismaActive) {
      return;
    }
    const activeDb = initDb();
    if (!activeDb.processedTransactions.includes(transactionId)) {
      activeDb.processedTransactions.push(transactionId);
      saveDb(activeDb);
    }
  },

  // --- SITES ---
  async getSitesForUser(userId: string): Promise<Site[]> {
    if (isPrismaActive) {
      try {
        const sites = await prisma.site.findMany({
          where: { userId }
        });
        return sites.map(s => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString()
        })) as any;
      } catch (err) {
        console.error("Site querying failed:", err);
      }
    }
    const activeDb = initDb();
    return activeDb.sites.filter(s => s.userId === userId);
  },

  async addSiteToUser(userId: string, url: string, wpUsername: string, wpAppPasswordEncrypted: string, hasWooCommerce: boolean): Promise<Site> {
    const normalizedUrl = url.toLowerCase().replace(/\/+$/, "");
    if (isPrismaActive) {
      try {
        const existing = await prisma.site.findFirst({
          where: { userId, url: { equals: normalizedUrl, mode: "insensitive" } }
        });
        if (existing) {
          throw new Error(`The WordPress site ${url} is already connected to your account.`);
        }
        const newSite = await prisma.site.create({
          data: {
            userId,
            url: normalizedUrl,
            wpUsername,
            wpAppPasswordEncrypted,
            hasWooCommerce,
          }
        });
        return {
          ...newSite,
          createdAt: newSite.createdAt.toISOString(),
          updatedAt: newSite.updatedAt.toISOString(),
        } as any;
      } catch (err) {
        console.error("Persisting WordPress Site node fails:", err);
        throw err;
      }
    }

    const activeDb = initDb();
    const existing = activeDb.sites.find(s => s.userId === userId && s.url.toLowerCase().replace(/\/+$/, "") === normalizedUrl);
    if (existing) {
      throw new Error(`The WordPress site ${url} is already connected to your account.`);
    }

    const newSite: Site = {
      id: `site_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      url: normalizedUrl,
      wpUsername,
      wpAppPasswordEncrypted,
      hasWooCommerce,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    activeDb.sites.push(newSite);
    saveDb(activeDb);
    return newSite;
  },

  async deleteSiteFromUser(userId: string, siteId: string): Promise<void> {
    if (isPrismaActive) {
      try {
        await prisma.site.delete({
          where: { id: siteId, userId }
        });
      } catch {
        // Safe to ignore if already unlinked
      }
      return;
    }
    const activeDb = initDb();
    activeDb.sites = activeDb.sites.filter(s => !(s.id === siteId && s.userId === userId));
    activeDb.products = activeDb.products.filter(p => p.siteId !== siteId);
    saveDb(activeDb);
  },

  // --- ACTIVITY LOGS ---
  async createActivityLog(userId: string | null, action: string, detailsObj: object, ip: string | null, ua: string | null): Promise<ActivityLog> {
    if (isPrismaActive) {
      try {
        const log = await prisma.activityLog.create({
          data: {
            userId,
            action,
            details: JSON.stringify(detailsObj),
            ipAddress: ip,
            userAgent: ua,
          }
        });
        return {
          ...log,
          createdAt: log.createdAt.toISOString(),
        } as any;
      } catch (err) {
        console.error("Persistent logging failed:", err);
      }
    }

    const activeDb = initDb();
    const newLog: ActivityLog = {
      id: `log_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      action,
      details: JSON.stringify(detailsObj),
      ipAddress: ip,
      userAgent: ua,
      createdAt: new Date().toISOString()
    };
    activeDb.activityLogs.unshift(newLog);
    saveDb(activeDb);
    return newLog;
  },

  async getActivityLogs(userId: string): Promise<ActivityLog[]> {
    if (isPrismaActive) {
      try {
        const logs = await prisma.activityLog.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" }
        });
        return logs.map(log => ({
          ...log,
          createdAt: log.createdAt.toISOString(),
        })) as any;
      } catch (err) {
        console.error("Audit loading failure:", err);
      }
    }
    const activeDb = initDb();
    return activeDb.activityLogs.filter(log => log.userId === userId);
  },

  // --- PRODUCTS & MEDIA ---
  async getProductsForUser(userId: string): Promise<(Product & { siteUrl: string; media: Media[] })[]> {
    if (isPrismaActive) {
      try {
        const userSites = await prisma.site.findMany({ where: { userId } });
        const siteIds = userSites.map(s => s.id);
        const siteMap = new Map(userSites.map(s => [s.id, s.url]));

        const products = await prisma.product.findMany({
          where: { siteId: { in: siteIds } },
          include: { media: true, seoHistory: { orderBy: { createdAt: "desc" } } }
        });

        return products.map(p => ({
          id: p.id,
          siteId: p.siteId,
          externalId: p.externalId,
          sku: p.sku,
          name: p.name,
          status: p.status,
          description: p.description,
          shortDescription: p.shortDescription,
          originalTitle: p.originalTitle,
          originalDescription: p.originalDescription,
          originalShortDescription: p.originalShortDescription,
          originalAltText: p.originalAltText,
          aiTitleGenerated: p.aiTitleGenerated,
          aiDescriptionGenerated: p.aiDescriptionGenerated,
          aiMetaDescriptionGenerated: p.aiMetaDescriptionGenerated,
          syncStatus: p.syncStatus as any,
          isSynced: p.isSynced,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          siteUrl: siteMap.get(p.siteId) || "",
          media: p.media.map(m => ({
            ...m,
            createdAt: m.createdAt.toISOString(),
            updatedAt: m.updatedAt.toISOString(),
          })) as any,
          seoHistory: p.seoHistory.map(sh => ({
            ...sh,
            createdAt: sh.createdAt.toISOString()
          })) as any
        })) as any;
      } catch (err) {
        console.error("Products querying fails:", err);
      }
    }

    const activeDb = initDb();
    const userSites = activeDb.sites.filter(s => s.userId === userId);
    const siteMap = new Map(userSites.map(s => [s.id, s.url]));
    const siteIds = new Set(userSites.map(s => s.id));
    
    return activeDb.products
      .filter(p => siteIds.has(p.siteId))
      .map(p => ({
        ...p,
        siteUrl: siteMap.get(p.siteId) || "",
        media: activeDb.media.filter(m => m.productId === p.id),
        seoHistory: (activeDb.seoHistories || [])
          .filter(sh => sh.productId === p.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      }));
  },

  async getProductById(productId: string): Promise<Product | undefined> {
    if (isPrismaActive) {
      try {
        const p = await prisma.product.findUnique({
          where: { id: productId }
        });
        if (!p) return undefined;
        return {
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        } as any;
      } catch (err) {
        console.error("Single product indexing fails:", err);
      }
    }
    const activeDb = initDb();
    return activeDb.products.find(p => p.id === productId);
  },

  async upsertProduct(
    siteId: string, 
    externalId: number, 
    productDetails: Partial<Omit<Product, "id" | "siteId" | "externalId" | "createdAt" | "updatedAt">>
  ): Promise<Product> {
    if (isPrismaActive) {
      try {
        const p = await prisma.product.upsert({
          where: {
            siteId_externalId: { siteId, externalId }
          },
          update: {
            sku: productDetails.sku,
            name: productDetails.name,
            status: productDetails.status,
            description: productDetails.description,
            shortDescription: productDetails.shortDescription,
            originalTitle: productDetails.originalTitle,
            originalDescription: productDetails.originalDescription,
            originalShortDescription: productDetails.originalShortDescription,
            originalAltText: productDetails.originalAltText,
            aiTitleGenerated: productDetails.aiTitleGenerated,
            aiDescriptionGenerated: productDetails.aiDescriptionGenerated,
            aiMetaDescriptionGenerated: productDetails.aiMetaDescriptionGenerated,
            syncStatus: productDetails.syncStatus as any,
            isSynced: productDetails.isSynced,
          },
          create: {
            siteId,
            externalId,
            sku: productDetails.sku || null,
            name: productDetails.name || "Unnamed Item",
            status: productDetails.status || "publish",
            description: productDetails.description || null,
            shortDescription: productDetails.shortDescription || null,
            originalTitle: productDetails.originalTitle || null,
            originalDescription: productDetails.originalDescription || null,
            originalShortDescription: productDetails.originalShortDescription || null,
            originalAltText: productDetails.originalAltText || null,
            aiTitleGenerated: productDetails.aiTitleGenerated || null,
            aiDescriptionGenerated: productDetails.aiDescriptionGenerated || null,
            aiMetaDescriptionGenerated: productDetails.aiMetaDescriptionGenerated || null,
            syncStatus: (productDetails.syncStatus as any) || "PENDING",
            isSynced: productDetails.isSynced || false,
          }
        });
        return {
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        } as any;
      } catch (err) {
        console.error("Product upsert failed:", err);
        throw err;
      }
    }

    const activeDb = initDb();
    const existingIndex = activeDb.products.findIndex(p => p.siteId === siteId && p.externalId === externalId);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      const oldProduct = activeDb.products[existingIndex];
      const updatedProduct: Product = {
        ...oldProduct,
        ...productDetails,
        updatedAt: now
      };
      activeDb.products[existingIndex] = updatedProduct;
      saveDb(activeDb);
      return updatedProduct;
    } else {
      const newProduct: Product = {
        id: `prod_${Math.random().toString(36).substring(2, 11)}`,
        siteId,
        externalId,
        sku: productDetails.sku || null,
        name: productDetails.name || "Unnamed Item",
        status: productDetails.status || "publish",
        description: productDetails.description || null,
        shortDescription: productDetails.shortDescription || null,
        originalTitle: productDetails.originalTitle || null,
        originalDescription: productDetails.originalDescription || null,
        originalShortDescription: productDetails.originalShortDescription || null,
        originalAltText: productDetails.originalAltText || null,
        aiTitleGenerated: productDetails.aiTitleGenerated || null,
        aiDescriptionGenerated: productDetails.aiDescriptionGenerated || null,
        aiMetaDescriptionGenerated: productDetails.aiMetaDescriptionGenerated || null,
        syncStatus: productDetails.syncStatus || SyncStatus.PENDING,
        isSynced: productDetails.isSynced || false,
        createdAt: now,
        updatedAt: now
      };
      activeDb.products.push(newProduct);
      saveDb(activeDb);
      return newProduct;
    }
  },

  async getMediaForProduct(productId: string): Promise<Media[]> {
    if (isPrismaActive) {
      try {
        const list = await prisma.media.findMany({ where: { productId } });
        return list.map(m => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        })) as any;
      } catch (err) {
        console.error("error fetching media for product", err);
        return [];
      }
    }
    const activeDb = initDb();
    return (activeDb.media || []).filter(m => m.productId === productId);
  },

  async upsertMedia(
    productId: string, 
    externalId: number, 
    mediaDetails: Partial<Omit<Media, "id" | "productId" | "externalId" | "createdAt" | "updatedAt">>
  ): Promise<Media> {
    if (isPrismaActive) {
      try {
        const m = await prisma.media.upsert({
          where: {
            productId_externalId: { productId, externalId }
          },
          update: {
            url: mediaDetails.url,
            altText: mediaDetails.altText,
            aiAltTextGenerated: mediaDetails.aiAltTextGenerated,
            isSynced: mediaDetails.isSynced,
          },
          create: {
            productId,
            externalId,
            url: mediaDetails.url || "",
            altText: mediaDetails.altText || null,
            aiAltTextGenerated: mediaDetails.aiAltTextGenerated || null,
            isSynced: mediaDetails.isSynced || false,
          }
        });
        return {
          ...m,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        } as any;
      } catch (err) {
        console.error("Media upsert aborted:", err);
        throw err;
      }
    }

    const activeDb = initDb();
    const existingIndex = activeDb.media.findIndex(m => m.productId === productId && m.externalId === externalId);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      const oldMedia = activeDb.media[existingIndex];
      const updatedMedia: Media = {
        ...oldMedia,
        ...mediaDetails,
        updatedAt: now
      };
      activeDb.media[existingIndex] = updatedMedia;
      saveDb(activeDb);
      return updatedMedia;
    } else {
      const newMedia: Media = {
        id: `med_${Math.random().toString(36).substring(2, 11)}`,
        productId,
        externalId,
        url: mediaDetails.url || "",
        altText: mediaDetails.altText || null,
        aiAltTextGenerated: mediaDetails.aiAltTextGenerated || null,
        isSynced: mediaDetails.isSynced || false,
        createdAt: now,
        updatedAt: now
      };
      activeDb.media.push(newMedia);
      saveDb(activeDb);
      return newMedia;
    }
  },

  async createSeoHistory(details: Omit<SeoHistory, "id" | "createdAt">): Promise<SeoHistory> {
    if (isPrismaActive) {
      const sh = await prisma.seoHistory.create({
        data: {
          productId: details.productId,
          provider: details.provider,
          originalTitle: details.originalTitle,
          originalDescription: details.originalDescription,
          originalShortDescription: details.originalShortDescription,
          originalAltText: details.originalAltText,
          generatedTitle: details.generatedTitle,
          generatedDescription: details.generatedDescription,
          generatedMetaDescription: details.generatedMetaDescription,
          generatedAltText: details.generatedAltText,
        }
      });
      return {
        ...sh,
        createdAt: sh.createdAt.toISOString()
      };
    }
    const activeDb = initDb();
    if (!activeDb.seoHistories) activeDb.seoHistories = [];
    const sh: SeoHistory = {
      id: `seoh_${Math.random().toString(36).substring(2, 11)}`,
      ...details,
      createdAt: new Date().toISOString()
    };
    activeDb.seoHistories.push(sh);
    saveDb(activeDb);
    return sh;
  },

  async getSeoHistoryForProduct(productId: string): Promise<SeoHistory[]> {
    if (isPrismaActive) {
      const histories = await prisma.seoHistory.findMany({
        where: { productId },
        orderBy: { createdAt: "desc" }
      });
      return histories.map(h => ({
        ...h,
        createdAt: h.createdAt.toISOString()
      }));
    }
    const activeDb = initDb();
    if (!activeDb.seoHistories) activeDb.seoHistories = [];
    return activeDb.seoHistories
      .filter(h => h.productId === productId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getRestorePointsForSite(siteId: string): Promise<RestorePoint[]> {
    if (isPrismaActive) {
      try {
        let pts = await prisma.restorePoint.findMany({
          where: { siteId },
          orderBy: { timestamp: "desc" }
        });
        if (pts.length === 0) {
          const seedPoints = [
            {
              siteId,
              resourceId: 1001,
              title: "Version 3 - Active RankFlow AI Optimized State (SEO Draft)",
              description: "Optimized title and highly engaging meta descriptions with optimal keywords density for orthopedic support chairs.",
              content: "Meet the peak of modern workplace orthopedics. This premium ergonomic task chair merges active postural adaptation with a high-tensile breathable carbon fiber mesh. Features our patented bio-mechanical fluid lumbar tension control, 4D structural armrests, and dynamic micro-tilt responsiveness.",
              metaFields: JSON.stringify([
                { key: "_yoast_wpseo_title", value: "Premium Orthopedic Mesh Office Chair - Adaptive Lumbar Tension" },
                { key: "_yoast_wpseo_metadesc", value: "The absolute pinnacle of seating biology. Eradicate lower back strain with active polyurethane weave back support. Secure premium pricing today." }
              ]),
              images: JSON.stringify([
                { id: 8551, url: "https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=600&q=80", alt: "Carbon Weave Ergonomic Backrest Overview" }
              ]),
              timestamp: new Date(Date.now() - 30 * 60000)
            },
            {
              siteId,
              resourceId: 1001,
              title: "Version 2 - Prior to Yoast SEO schema adjustment patch",
              description: "Get the perfect balance of posture correction and modern aesthetic design. This ergonomic chair includes orthopedic posture mechanics.",
              content: "Our high-performance computer workspace seating is engineered with professional multi-point lumbar control, deep-contour breathable mesh upholstery, adjust-anywhere 4D padded armrests, and smooth, silent glide base structure.",
              metaFields: JSON.stringify([
                { key: "_yoast_wpseo_title", value: "Ergonomic Lumbar Support Office Chair | Active Workplace Health" },
                { key: "_yoast_wpseo_metadesc", value: "Upgrade your desk setup with our orthopedic posture correction mesh executive seating. Order now for Free Expedited Shipping and lifetime utility." }
              ]),
              images: JSON.stringify([
                { id: 8551, url: "https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=600&q=80", alt: "Adjustable Ergonomic Seat" }
              ]),
              timestamp: new Date(Date.now() - 4 * 3600000)
            },
            {
              siteId,
              resourceId: 1001,
              title: "Version 1 - Baseline WooCommerce Store State (Initial Import)",
              description: "Looking for top-notch comfort? This office chair is built with PU leather, plastic frames and standard lumbar tension settings.",
              content: "Our standard mesh task seat is built for general office use. Adjustable hydraulic column handles elevations while standard polyurethane roll-castings glide over standard office carpet fibers.",
              metaFields: JSON.stringify([
                { key: "_yoast_wpseo_title", value: "Premium Ergonomic Office Chair" },
                { key: "_yoast_wpseo_metadesc", value: "Buy office chair with adjustable backrest features. Cheap delivery available nationwide." }
              ]),
              images: JSON.stringify([
                { id: 8551, url: "https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=600&q=80", alt: "Mesh Chair" }
              ]),
              timestamp: new Date(Date.now() - 24 * 3600000)
            }
          ];

          for (const sp of seedPoints) {
            await prisma.restorePoint.create({ data: sp });
          }

          pts = await prisma.restorePoint.findMany({
            where: { siteId },
            orderBy: { timestamp: "desc" }
          });
        }
        return pts.map(p => ({
          ...p,
          timestamp: p.timestamp.toISOString()
        })) as any;
      } catch (err) {
        console.error("Prisma error pulling restore points for site:", err);
      }
    }
    const activeDb = initDb();
    if (!activeDb.restorePoints) activeDb.restorePoints = [];
    const localPts = activeDb.restorePoints.filter(p => p.siteId === siteId);
    if (localPts.length === 0) {
      const seedPoints = [
        {
          id: "rp_v3_" + Math.random().toString(36).substring(2, 9),
          siteId,
          resourceId: 1001,
          title: "Version 3 - Active RankFlow AI Optimized State (SEO Draft)",
          description: "Optimized title and highly engaging meta descriptions with optimal keywords density for orthopedic support chairs.",
          content: "Meet the peak of modern workplace orthopedics. This premium ergonomic task chair merges active postural adaptation with a high-tensile breathable carbon fiber mesh. Features our patented bio-mechanical fluid lumbar tension control, 4D structural armrests, and dynamic micro-tilt responsiveness to physical shifts.",
          metaFields: JSON.stringify([
            { key: "_yoast_wpseo_title", value: "Premium Orthopedic Mesh Office Chair - Adaptive Lumbar Tension" },
            { key: "_yoast_wpseo_metadesc", value: "The absolute pinnacle of seating biology. Eradicate lower back strain with active polyurethane weave back support. Secure premium pricing today." }
          ]),
          images: JSON.stringify([
            { id: 8551, url: "https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=600&q=80", alt: "Carbon Weave Ergonomic Backrest Overview" }
          ]),
          timestamp: new Date(Date.now() - 30 * 60000).toISOString()
        },
        {
          id: "rp_v2_" + Math.random().toString(36).substring(2, 9),
          siteId,
          resourceId: 1001,
          title: "Version 2 - Prior to Yoast SEO schema adjustment patch",
          description: "Get the perfect balance of posture correction and modern aesthetic design. This ergonomic chair includes orthopedic posture mechanics.",
          content: "Our high-performance computer workspace seating is engineered with professional multi-point lumbar control, deep-contour breathable mesh upholstery, adjust-anywhere 4D padded armrests, and smooth, silent glide base structure. Relieve persistent vertebrae fatigue with absolute sitting wellness.",
          metaFields: JSON.stringify([
            { key: "_yoast_wpseo_title", value: "Ergonomic Lumbar Support Office Chair | Active Workplace Health" },
            { key: "_yoast_wpseo_metadesc", value: "Upgrade your desk setup with our orthopedic posture correction mesh executive seating. Order now for Free Expedited Shipping and lifetime utility." }
          ]),
          images: JSON.stringify([
            { id: 8551, url: "https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=600&q=80", alt: "Adjustable Ergonomic Seat" }
          ]),
          timestamp: new Date(Date.now() - 4 * 3600000).toISOString()
        },
        {
          id: "rp_v1_" + Math.random().toString(36).substring(2, 9),
          siteId,
          resourceId: 1001,
          title: "Version 1 - Baseline WooCommerce Store State (Initial Import)",
          description: "Looking for top-notch comfort? This office chair is built with PU leather, plastic frames and standard lumbar tension settings.",
          content: "Our standard mesh task seat is built for general office use. Adjustable hydraulic column handles elevations while standard polyurethane roll-castings glide over standard office carpet fibers.",
          metaFields: JSON.stringify([
            { key: "_yoast_wpseo_title", value: "Premium Ergonomic Office Chair" },
            { key: "_yoast_wpseo_metadesc", value: "Buy office chair with adjustable backrest features. Cheap delivery available nationwide." }
          ]),
          images: JSON.stringify([
            { id: 8551, url: "https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=600&q=80", alt: "Mesh Chair" }
          ]),
          timestamp: new Date(Date.now() - 24 * 3600000).toISOString()
        }
      ];
      activeDb.restorePoints.push(...seedPoints);
      saveDb(activeDb);
      return seedPoints;
    }
    return activeDb.restorePoints
      .filter(p => p.siteId === siteId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  async getRestorePointById(id: string): Promise<RestorePoint | undefined> {
    if (isPrismaActive) {
      try {
        const pt = await prisma.restorePoint.findUnique({
          where: { id }
        });
        if (!pt) return undefined;
        return {
          ...pt,
          timestamp: pt.timestamp.toISOString()
        } as any;
      } catch (err) {
        console.error("Prisma error pulling restore point by ID:", err);
      }
    }
    const activeDb = initDb();
    if (!activeDb.restorePoints) activeDb.restorePoints = [];
    return activeDb.restorePoints.find(p => p.id === id);
  },

  async createRestorePoint(details: Omit<RestorePoint, "id" | "timestamp">): Promise<RestorePoint> {
    if (isPrismaActive) {
      try {
        const pt = await prisma.restorePoint.create({
          data: {
            siteId: details.siteId,
            resourceId: details.resourceId,
            title: details.title,
            description: details.description,
            content: details.content,
            metaFields: details.metaFields,
            images: details.images
          }
        });
        return {
          ...pt,
          timestamp: pt.timestamp.toISOString()
        } as any;
      } catch (err) {
        console.error("Prisma error creating restore point:", err);
        throw err;
      }
    }
    const activeDb = initDb();
    if (!activeDb.restorePoints) activeDb.restorePoints = [];
    const pt: RestorePoint = {
      id: `rp_${Math.random().toString(36).substring(2, 9)}_${Math.random().toString(36).substring(2, 9)}`,
      siteId: details.siteId,
      resourceId: details.resourceId,
      title: details.title,
      description: details.description,
      content: details.content,
      metaFields: details.metaFields,
      images: details.images,
      timestamp: new Date().toISOString()
    };
    activeDb.restorePoints.push(pt);
    saveDb(activeDb);
    return pt;
  }
};
