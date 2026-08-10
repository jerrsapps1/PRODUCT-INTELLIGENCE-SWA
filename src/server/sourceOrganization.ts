import type { AuthorityClassification, SourceRecord } from "../shared/contracts";

const authorityTagMap: Record<AuthorityClassification, string> = {
  regulatory_requirement: "Regulatory",
  project_requirement: "Project Requirement",
  owner_requirement: "Owner Requirement",
  gc_policy: "GC Policy",
  general_reference: "General Reference",
  contractor_submission: "Contractor Submission",
  working_document: "Plan / Procedure",
  generated_artifact: "Other"
};

const keywordTags: Array<{ tag: string; patterns: RegExp[] }> = [
  { tag: "Regulatory", patterns: [/\bosha\b/i, /\bem\s*385/i, /\bniosh\b/i, /\bcfr\b/i] },
  { tag: "Incident Documentation", patterns: [/\bincident\b/i, /\binvestigation\b/i, /\bnear[-\s]?miss\b/i] },
  { tag: "Plan / Procedure", patterns: [/\bplan\b/i, /\bprocedure\b/i, /\bsop\b/i, /\bmethod statement\b/i] },
  { tag: "Manufacturer / Technical", patterns: [/\bmanual\b/i, /\bmanufacturer\b/i, /\btechnical\b/i, /\bsds\b/i] },
  { tag: "Owner Requirement", patterns: [/\bowner\b/i, /\bclient\b/i] },
  { tag: "GC Policy", patterns: [/\bgc\b/i, /\bpolicy\b/i] },
  { tag: "Contractor Submission", patterns: [/\bsubmittal\b/i, /\bcontractor\b/i, /\bsubcontractor\b/i] }
];

export function suggestTagsForSource(source: SourceRecord): string[] {
  const haystack = [
    source.title,
    source.originalFilename,
    source.originalUrl,
    source.sourceType,
    source.scope,
    source.authorityClassification
  ].filter(Boolean).join(" ");
  const tags = new Set<string>([authorityTagMap[source.authorityClassification]]);
  for (const candidate of keywordTags) {
    if (candidate.patterns.some((pattern) => pattern.test(haystack))) tags.add(candidate.tag);
  }
  if (tags.size === 0) tags.add("Other");
  return [...tags].slice(0, 8);
}
