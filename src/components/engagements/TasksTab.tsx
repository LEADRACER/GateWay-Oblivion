'use client';

import {
  useEngagementTasks, useEngagementActions,
  type Engagement, type EngagementTask,
} from '@/hooks/useEngagements';

const COLUMNS = ['planned', 'ready', 'executing', 'blocked', 'done'];

export function TasksTab({ engagement }: { engagement: Engagement }) {
  const { data: tasks = [] } = useEngagementTasks(engagement.id);
  const actions = useEngagementActions();

  const move = (task: EngagementTask, status: string) => actions.patch.mutate({
    path: `/api/engagements/${engagement.id}/tasks/${task.id}`,
    body: { status },
    engagementId: engagement.id,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {COLUMNS.map((column) => {
        const items = tasks.filter((task) => task.status === column);
        return (
          <div key={column} className="border border-border bg-bg/60 p-2 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[9px] tracking-widest text-text-dim uppercase">{column}</span>
              <span className="font-mono text-[9px] text-text-muted">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 && (
                <div className="p-2 border border-dashed border-border font-mono text-[8px] text-text-dim text-center">
                  EMPTY
                </div>
              )}
              {items.map((task) => (
                <div key={task.id} className="p-2 border border-border bg-surface">
                  <div className="font-mono text-[10px] text-text leading-snug">{task.title}</div>
                  <div className="font-mono text-[8px] text-text-dim mt-1 truncate">
                    {task.tool ? `${task.tool}::${task.action}` : task.technique || 'MANUAL'}
                    {task.gate ? ' · GATED' : ''}
                  </div>
                  {task.gate && (
                    <button
                      onClick={() => actions.post.mutate({
                        path: `/api/engagements/${engagement.id}/tasks/${task.id}/approve`,
                        body: { reason: 'approved from engagement board' },
                        engagementId: engagement.id,
                      })}
                      className="mt-2 font-mono text-[8px] tracking-widest text-warning border border-warning/40 px-2 py-1"
                    >
                      APPROVE
                    </button>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {COLUMNS.filter((target) => target !== column).map((target) => (
                      <button
                        key={target}
                        onClick={() => move(task, target)}
                        title={`Move to ${target}`}
                        className="font-mono text-[7px] text-text-dim border border-border px-1 py-0.5 hover:text-accent"
                      >
                        →{target.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
