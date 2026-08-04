import type { AutomationTemplate, TemplateCategory } from "./automation-templates";

/**
 * Comment-automation templates.
 *
 * The comments feature is a separate product surface that did not come across
 * into this repo, so the category exists (the templates tab still renders its
 * filter) but ships no templates.
 */

export const COMMENT_TEMPLATE_CATEGORY = "comments" as const;

const COMMENTS_SERVICE = "comments";

export const COMMENT_AUTOMATION_TEMPLATES: AutomationTemplate[] = [];

/** True when a template builds a comment automation rather than an ad automation. */
export function isCommentAutomationTemplate(template: {
  readonly flow?: { readonly nodes?: ReadonlyArray<{ readonly service?: string }> };
}): boolean {
  return Boolean(template.flow?.nodes?.some((node) => node.service === COMMENTS_SERVICE));
}

export type { TemplateCategory };
