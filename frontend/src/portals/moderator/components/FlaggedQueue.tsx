import { Link } from 'react-router-dom';
import {
  IconArrowRight,
  IconCalendar,
  IconHash,
  IconPercentage,
  IconTag,
} from '@tabler/icons-react';
import { Badge, Card, EmptyState } from '../../../shared/ui';
import type { ReportListItem } from '../types';

type ScoreKey = 'duplicate_score' | 'fraud_score';

export interface FlaggedQueueProps {
  title: string;
  description: string;
  items: ReportListItem[];
  scoreKey: ScoreKey;
  emptyTitle: string;
  emptyDescription: string;
}

function scoreFor(item: ReportListItem, key: ScoreKey): number | null {
  return key === 'duplicate_score' ? item.duplicate_score : item.fraud_score;
}

export function FlaggedQueue({
  title,
  description,
  items,
  scoreKey,
  emptyTitle,
  emptyDescription,
}: FlaggedQueueProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--color-ink)]">{title}</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
      </header>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            const score = scoreFor(r, scoreKey);
            return (
              <Card
                key={r.id}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-[var(--color-canvas)] p-1.5">
                      <IconHash
                        className="h-4 w-4 text-[var(--color-text-tertiary)]"
                        stroke={1.6}
                      />
                    </div>
                    <span className="font-mono text-sm font-medium text-[var(--color-ink)]">
                      {r.tracking_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <IconCalendar
                      className="h-4 w-4 text-[var(--color-text-tertiary)]"
                      stroke={1.6}
                    />
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {new Date(r.submitted_at).toLocaleString()}
                    </span>
                  </div>
                  {r.category && (
                    <div className="flex items-center gap-2">
                      <IconTag className="h-4 w-4 text-[var(--color-text-tertiary)]" stroke={1.6} />
                      <span className="text-sm text-[var(--color-ink)]">{r.category.name}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {score !== null && (
                    <div className="flex items-center gap-1.5">
                      <IconPercentage
                        className="h-4 w-4 text-[var(--color-text-tertiary)]"
                        stroke={1.6}
                      />
                      <Badge tone={score > 80 ? 'danger' : 'warning'}>{score.toFixed(0)}%</Badge>
                    </div>
                  )}
                  <Link
                    to={`/moderator/reports/${r.id}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 text-sm font-medium text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2"
                  >
                    Review
                    <IconArrowRight className="h-4 w-4" stroke={1.6} />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
