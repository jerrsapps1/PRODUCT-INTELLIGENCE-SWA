import { z } from "zod";

export const federalClassifications = ["Federal", "Non-Federal"] as const;

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(160),
  projectIdentifier: z.string().trim().max(80).optional().or(z.literal("")),
  location: z.string().trim().min(1, "Location is required").max(180),
  federalClassification: z.enum(federalClassifications),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""))
});

export const contractorCreateSchema = z.object({
  legalName: z.string().trim().min(1, "Legal name is required").max(180),
  trade: z.string().trim().max(120).optional().or(z.literal("")),
  primaryContactName: z.string().trim().max(140).optional().or(z.literal("")),
  primaryContactEmail: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(60).optional().or(z.literal(""))
});

export const engagementCreateSchema = z.object({
  contractorId: z.string().uuid().optional(),
  contractor: contractorCreateSchema.optional(),
  scopeSummary: z.string().trim().max(1000).optional().or(z.literal(""))
}).refine((value) => value.contractorId || value.contractor, {
  message: "Choose an existing contractor or create a new contractor"
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export type FederalClassification = (typeof federalClassifications)[number];
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ContractorCreateInput = z.infer<typeof contractorCreateSchema>;
export type EngagementCreateInput = z.infer<typeof engagementCreateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
}

export interface Project {
  id: string;
  ownerUserId: string;
  name: string;
  projectIdentifier: string | null;
  location: string;
  federalClassification: FederalClassification;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contractor {
  id: string;
  ownerUserId: string;
  legalName: string;
  trade: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectContractorEngagement {
  id: string;
  projectId: string;
  contractorId: string;
  scopeSummary: string | null;
  createdAt: string;
  updatedAt: string;
  contractor?: Contractor;
}

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}
