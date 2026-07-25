import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Bot, Check, ScrollText, Sparkles, X } from 'lucide-react';
import { EModelEndpoint } from 'librechat-data-provider';
import type { TSkillSummary } from 'librechat-data-provider';
import { useSetRecoilState } from 'recoil';
import type { ConvoGenerator, MentionOption } from '~/common';
import { isEphemeralAgent, mainTextareaId } from '~/common';
import {
  useAgentsMapContext,
  useAssistantsMapContext,
} from '~/Providers';
import { useGetConversation, useSkillActiveState } from '~/hooks';
import useMentions from '~/hooks/Input/useMentions';
import useSelectMention from '~/hooks/Input/useSelectMention';
import { useSkillsInfiniteQuery } from '~/data-provider';
import { ephemeralAgentByConvoId } from '~/store';
import store from '~/store';
import { cn } from '~/utils';
import { filterSkillsForPopover } from './SkillsCommand';

const MIN_QUERY_LENGTH = 10;
const MAX_SKILL_SUGGESTIONS = 3;

const DOMAIN_TERMS: Record<string, string[]> = {
  coding: [
    'code',
    'coding',
    'programming',
    'bug',
    'debug',
    'review',
    'refactor',
    'typescript',
    'javascript',
    'react',
    'node',
    'python',
    'php',
    'laravel',
    'sql',
    'api',
    'كود',
    'برمجة',
    'برمجي',
    'خطأ',
    'مشكلة',
    'اصلح',
    'إصلاح',
    'راجع',
    'تطوير',
  ],
  devops: [
    'railway',
    'docker',
    'deploy',
    'deployment',
    'server',
    'logs',
    'log',
    'github actions',
    'ci',
    'cd',
    'kubernetes',
    'nginx',
    'ريل واي',
    'دوكر',
    'نشر',
    'سيرفر',
    'خادم',
    'لوج',
    'سجلات',
  ],
  research: [
    'research',
    'search',
    'browse',
    'latest',
    'sources',
    'compare',
    'ابحث',
    'بحث',
    'دور',
    'مصادر',
    'احدث',
    'أحدث',
    'قارن',
  ],
  documents: [
    'pdf',
    'document',
    'docx',
    'file',
    'summarize',
    'translate',
    'spreadsheet',
    'excel',
    'csv',
    'ملف',
    'مستند',
    'لخص',
    'تلخيص',
    'ترجم',
    'اكسل',
    'إكسل',
    'بيانات',
  ],
  business: [
    'business',
    'strategy',
    'marketing',
    'sales',
    'market',
    'proposal',
    'خطة',
    'استراتيجية',
    'تسويق',
    'مبيعات',
    'سوق',
    'عرض',
    'عميل',
  ],
  security: [
    'security',
    'secure',
    'vulnerability',
    'owasp',
    'hardening',
    'incident',
    'أمن',
    'امان',
    'أمان',
    'ثغرة',
    'حماية',
  ],
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[^\p{L}\p{N}+#.\-/]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((token) => token.length > 1),
  );
}

function detectDomains(query: string): Set<string> {
  const normalized = normalizeText(query);
  const domains = new Set<string>();
  for (const [domain, terms] of Object.entries(DOMAIN_TERMS)) {
    if (terms.some((term) => normalized.includes(normalizeText(term)))) {
      domains.add(domain);
    }
  }
  return domains;
}

function scoreCandidate(query: string, label: string, description = ''): number {
  const queryTokens = tokenize(query);
  const normalizedLabel = normalizeText(label);
  const normalizedDescription = normalizeText(description);
  const labelTokens = tokenize(label);
  const descriptionTokens = tokenize(description);
  const domains = detectDomains(query);
  let score = 0;

  for (const token of queryTokens) {
    if (labelTokens.has(token)) {
      score += 4;
    } else if (descriptionTokens.has(token)) {
      score += 1.5;
    }
  }

  for (const [domain, terms] of Object.entries(DOMAIN_TERMS)) {
    if (!domains.has(domain)) {
      continue;
    }
    const candidateText = `${normalizedLabel} ${normalizedDescription}`;
    const hits = terms.reduce(
      (count, term) => count + (candidateText.includes(normalizeText(term)) ? 1 : 0),
      0,
    );
    score += Math.min(hits, 3) * 2;
  }

  if (normalizedLabel && normalizeText(query).includes(normalizedLabel)) {
    score += 8;
  }

  return score;
}

function isArabicInterface(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
}

type SkillSuggestion = {
  name: string;
  label: string;
  description: string;
  score: number;
};

type AgentSuggestion = {
  id: string;
  label: string;
  description: string;
  score: number;
};

export default function SmartCapabilityAdvisor({
  text,
  conversationId,
  currentAgentId,
  newConversation,
}: {
  text: string;
  conversationId: string;
  currentAgentId?: string | null;
  newConversation: ConvoGenerator;
}) {
  const deferredText = useDeferredValue(text);
  const agentsMap = useAgentsMapContext();
  const assistantsMap = useAssistantsMapContext();
  const { isActive } = useSkillActiveState();
  const setPendingManualSkills = useSetRecoilState(
    store.pendingManualSkillsByConvoId(conversationId),
  );
  const setEphemeralAgent = useSetRecoilState(ephemeralAgentByConvoId(conversationId));
  const getConversation = useGetConversation(0);
  const [dismissedText, setDismissedText] = useState('');
  const [appliedSkillNames, setAppliedSkillNames] = useState<Set<string>>(new Set());

  const { presets, modelSpecs, agentsList, endpointsConfig } = useMentions({
    assistantMap: assistantsMap || {},
    includeAssistants: false,
  });
  const { onSelectMention } = useSelectMention({
    presets,
    modelSpecs,
    assistantsMap,
    endpointsConfig,
    getConversation,
    newConversation,
  });

  const { data, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSkillsInfiniteQuery({ limit: 100 });

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const agentSkillIds = useMemo<string[] | null | undefined>(() => {
    if (!currentAgentId || isEphemeralAgent(currentAgentId)) {
      return undefined;
    }
    const agent = agentsMap?.[currentAgentId];
    if (!agent || agent.skills_enabled !== true) {
      return [];
    }
    return Array.isArray(agent.skills) && agent.skills.length > 0 ? agent.skills : undefined;
  }, [currentAgentId, agentsMap]);

  const allSkills = useMemo<TSkillSummary[]>(() => {
    const skills: TSkillSummary[] = [];
    for (const page of data?.pages ?? []) {
      skills.push(...page.skills);
    }
    return filterSkillsForPopover(skills, { agentSkillIds, isActive });
  }, [data?.pages, agentSkillIds, isActive]);

  const skillSuggestions = useMemo<SkillSuggestion[]>(() => {
    if (normalizeText(deferredText).length < MIN_QUERY_LENGTH) {
      return [];
    }
    return allSkills
      .map((skill) => ({
        name: skill.name,
        label: skill.displayTitle ?? skill.name,
        description: skill.description ?? '',
        score: scoreCandidate(
          deferredText,
          `${skill.displayTitle ?? ''} ${skill.name}`,
          skill.description ?? '',
        ),
      }))
      .filter((suggestion) => suggestion.score >= 3)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, MAX_SKILL_SUGGESTIONS);
  }, [allSkills, deferredText]);

  const agentSuggestion = useMemo<AgentSuggestion | null>(() => {
    if (normalizeText(deferredText).length < MIN_QUERY_LENGTH || !agentsMap) {
      return null;
    }
    const suggestions = Object.entries(agentsMap)
      .filter(([id]) => id !== currentAgentId)
      .map(([id, agent]) => ({
        id,
        label: agent.name ?? 'Agent',
        description: agent.description ?? '',
        score: scoreCandidate(deferredText, agent.name ?? '', agent.description ?? ''),
      }))
      .filter((suggestion) => suggestion.score >= 3)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
    return suggestions[0] ?? null;
  }, [agentsMap, currentAgentId, deferredText]);

  const normalizedCurrentText = normalizeText(deferredText);
  const hasSuggestions = skillSuggestions.length > 0 || agentSuggestion != null;
  const hidden =
    normalizedCurrentText.length < MIN_QUERY_LENGTH ||
    normalizedCurrentText === dismissedText ||
    !hasSuggestions;

  useEffect(() => {
    setAppliedSkillNames(new Set());
  }, [normalizedCurrentText]);

  const applySkills = useCallback(() => {
    const names = skillSuggestions.map((skill) => skill.name);
    if (names.length === 0) {
      return;
    }
    setEphemeralAgent((prev) => (prev?.skills ? prev : { ...(prev || {}), skills: true }));
    setPendingManualSkills((prev) => [...new Set([...prev, ...names])]);
    setAppliedSkillNames(new Set(names));
    document.getElementById(mainTextareaId)?.focus();
  }, [skillSuggestions, setEphemeralAgent, setPendingManualSkills]);

  const switchAgent = useCallback(() => {
    if (!agentSuggestion) {
      return;
    }
    const option = agentsList?.find((agent) => agent.value === agentSuggestion.id) as
      | MentionOption
      | undefined;
    if (!option || option.type !== EModelEndpoint.agents) {
      return;
    }
    onSelectMention?.(option);
  }, [agentSuggestion, agentsList, onSelectMention]);

  if (hidden) {
    return null;
  }

  const rtl = isArabicInterface();
  const copy = rtl
    ? {
        title: 'اقتراحات ذكية للطلب',
        agent: 'الـAgent الأنسب',
        skills: 'Skills مقترحة',
        switchAgent: 'استخدام الـAgent',
        addSkills: 'إضافة الـSkills',
        added: 'تمت الإضافة',
        dismiss: 'إخفاء الاقتراحات',
      }
    : {
        title: 'Smart suggestions for this request',
        agent: 'Recommended agent',
        skills: 'Recommended skills',
        switchAgent: 'Use agent',
        addSkills: 'Add skills',
        added: 'Added',
        dismiss: 'Dismiss suggestions',
      };

  const skillsApplied =
    skillSuggestions.length > 0 &&
    skillSuggestions.every((skill) => appliedSkillNames.has(skill.name));

  return (
    <div
      className="mx-2 mt-2 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-3 text-sm text-text-primary"
      dir={rtl ? 'rtl' : 'ltr'}
      data-testid="smart-capability-advisor"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles className="h-4 w-4 text-cyan-500" />
          <span>{copy.title}</span>
        </div>
        <button
          type="button"
          className="rounded-lg p-1 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
          aria-label={copy.dismiss}
          onClick={() => setDismissedText(normalizedCurrentText)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {agentSuggestion && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-secondary-alt p-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Bot className="h-3.5 w-3.5" />
              <span>{copy.agent}</span>
            </div>
            <div className="mt-1 font-medium" dir="auto" style={{ unicodeBidi: 'isolate' }}>
              {agentSuggestion.label}
            </div>
            {agentSuggestion.description && (
              <div
                className="mt-0.5 line-clamp-2 text-xs text-text-secondary"
                dir="auto"
                style={{ unicodeBidi: 'plaintext' }}
              >
                {agentSuggestion.description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={switchAgent}
            className="rounded-lg border border-border-light bg-surface-primary px-3 py-1.5 text-xs font-medium hover:bg-surface-tertiary"
          >
            {copy.switchAgent}
          </button>
        </div>
      )}

      {skillSuggestions.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <ScrollText className="h-3.5 w-3.5" />
            <span>{copy.skills}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skillSuggestions.map((skill) => (
              <span
                key={skill.name}
                className="max-w-full truncate rounded-full border border-border-light bg-surface-primary px-2.5 py-1 text-xs"
                title={skill.description}
                dir="auto"
                style={{ unicodeBidi: 'isolate' }}
              >
                {skill.label}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={applySkills}
            disabled={skillsApplied}
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium',
              skillsApplied
                ? 'cursor-default border-green-500/30 bg-green-500/10 text-green-600'
                : 'border-border-light bg-surface-primary hover:bg-surface-tertiary',
            )}
          >
            {skillsApplied && <Check className="h-3.5 w-3.5" />}
            {skillsApplied ? copy.added : copy.addSkills}
          </button>
        </div>
      )}
    </div>
  );
}
