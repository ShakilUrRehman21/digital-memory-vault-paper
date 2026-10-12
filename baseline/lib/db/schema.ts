import { pgTable, uuid, varchar, text, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

// Enums
export const categoryEnum = pgEnum('category', ['career', 'finance', 'health', 'product', 'personal']);
export const emotionalStateEnum = pgEnum('emotional_state', ['calm', 'stressed', 'excited', 'pressured', 'uncertain']);
export const riskLevelEnum = pgEnum('risk_level', ['low', 'medium', 'high']);
export const statusEnum = pgEnum('status', ['pending_outcome', 'outcome_recorded']);

// Users table
export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Decisions table
export const decisions = pgTable('decisions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }).notNull(),
    category: categoryEnum('category').notNull(),
    description: text('description').notNull(),
    expectedOutcome: text('expected_outcome').notNull(),
    confidenceLevel: integer('confidence_level').notNull(), // 1-10
    emotionalState: emotionalStateEnum('emotional_state').notNull(),
    riskLevel: riskLevelEnum('risk_level').notNull(),
    decisionDate: timestamp('decision_date').notNull(),
    status: statusEnum('status').default('pending_outcome').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index('decisions_user_id_idx').on(table.userId),
    decisionDateIdx: index('decisions_date_idx').on(table.decisionDate),
    statusIdx: index('decisions_status_idx').on(table.status),
}));

// Outcomes table
export const outcomes = pgTable('outcomes', {
    id: uuid('id').defaultRandom().primaryKey(),
    decisionId: uuid('decision_id').notNull().references(() => decisions.id, { onDelete: 'cascade' }),
    actualOutcome: text('actual_outcome').notNull(),
    successRating: integer('success_rating').notNull(), // 1-10
    lessonLearned: text('lesson_learned').notNull(),
    reflection: text('reflection').notNull(),
    outcomeDate: timestamp('outcome_date').defaultNow().notNull(),
});

// Decision metrics snapshots
export const decisionMetrics = pgTable('decision_metrics', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    decisionAccuracyScore: integer('decision_accuracy_score').default(0).notNull(),
    riskCalibrationScore: integer('risk_calibration_score').default(0).notNull(),
    emotionalBiasScore: integer('emotional_bias_score').default(0).notNull(),
    confidenceCalibrationScore: integer('confidence_calibration_score').default(0).notNull(),
    snapshotDate: timestamp('snapshot_date').defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index('metrics_user_id_idx').on(table.userId),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Decision = typeof decisions.$inferSelect;
export type NewDecision = typeof decisions.$inferInsert;
export type Outcome = typeof outcomes.$inferSelect;
export type NewOutcome = typeof outcomes.$inferInsert;
export type DecisionMetric = typeof decisionMetrics.$inferSelect;
