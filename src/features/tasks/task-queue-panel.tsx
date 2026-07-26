"use client";

import Link from "next/link";
import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { opportunityNextActionLabels } from "@/features/opportunities/next-actions";
import type {
  TaskQueueItem,
  TaskQueueResult,
} from "@/server/tasks/task-queue-core";

import {
  completeTaskAction,
  rescheduleTaskAction,
} from "./actions";
import { initialTaskActionState } from "./task-state";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "short",
});

const replacementActions = [
  "call",
  "verify",
  "prepare_analysis",
  "prepare_appointment",
  "request_authorization",
  "other",
] as const;

const inputClassName =
  "mt-2 min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-base text-[var(--ink)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-emerald-900/5";

function FieldError({ errors }: { errors: string[] | undefined }) {
  if (!errors?.length) {
    return null;
  }

  return (
    <p className="mt-2 text-sm font-bold text-red-700" role="alert">
      {errors[0]}
    </p>
  );
}

function ActionMessage({
  state,
}: {
  state: typeof initialTaskActionState;
}) {
  if (state.formError) {
    return (
      <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800" role="alert">
        {state.formError}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800" role="status">
        {state.success}
      </p>
    );
  }

  return null;
}

function TaskActions({
  task,
  defaultActionAt,
}: {
  task: TaskQueueItem;
  defaultActionAt: string;
}) {
  const [rescheduleState, rescheduleAction] = useActionState(
    rescheduleTaskAction,
    initialTaskActionState,
  );
  const [completeState, completeAction] = useActionState(
    completeTaskAction,
    initialTaskActionState,
  );

  return (
    <details className="mt-4 rounded-2xl border border-[var(--line)] bg-slate-50">
      <summary className="min-h-12 cursor-pointer list-none px-4 py-3 text-sm font-extrabold text-[var(--brand)]">
        Görevi yönet
      </summary>
      <div className="border-t border-[var(--line)] p-4">
        <form action={rescheduleAction} aria-label="Görevi ertele">
          <input name="taskId" type="hidden" value={task.id} />
          <ActionMessage state={rescheduleState} />
          <label
            className="text-sm font-extrabold text-[var(--ink)]"
            htmlFor={`dueAt-${task.id}`}
          >
            Yeni görev tarihi
          </label>
          <input
            className={inputClassName}
            defaultValue={defaultActionAt}
            id={`dueAt-${task.id}`}
            name="dueAt"
            type="datetime-local"
          />
          <FieldError errors={rescheduleState.fieldErrors.dueAt} />
          <div className="mt-3">
            <SubmitButton pendingLabel="Erteleniyor…">
              Görevi ertele
            </SubmitButton>
          </div>
        </form>

        <div className="my-5 h-px bg-[var(--line)]" />

        <form action={completeAction} aria-label="Görevi tamamla">
          <input name="taskId" type="hidden" value={task.id} />
          <ActionMessage state={completeState} />

          {task.isCurrentNextAction ? (
            <>
              <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
                Bu görev fırsatın güncel sonraki işlemidir. Fırsatı açık tutmak
                için yeni işlem ve tarih seçin.
              </p>
              <label
                className="text-sm font-extrabold text-[var(--ink)]"
                htmlFor={`nextActionType-${task.id}`}
              >
                Yeni sonraki işlem
              </label>
              <select
                className={inputClassName}
                defaultValue="call"
                id={`nextActionType-${task.id}`}
                name="nextActionType"
              >
                {replacementActions.map((value) => (
                  <option key={value} value={value}>
                    {opportunityNextActionLabels[value]}
                  </option>
                ))}
              </select>
              <FieldError
                errors={completeState.fieldErrors.nextActionType}
              />

              <label
                className="mt-4 block text-sm font-extrabold text-[var(--ink)]"
                htmlFor={`nextActionAt-${task.id}`}
              >
                Yeni işlem tarihi
              </label>
              <input
                className={inputClassName}
                defaultValue={defaultActionAt}
                id={`nextActionAt-${task.id}`}
                name="nextActionAt"
                type="datetime-local"
              />
              <FieldError errors={completeState.fieldErrors.nextActionAt} />
            </>
          ) : (
            <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
              Fırsatın sonraki işlemi daha sonra değişmiş. Bu görev fırsat
              planını değiştirmeden tamamlanacak.
            </p>
          )}

          <div className="mt-4">
            <SubmitButton pendingLabel="Tamamlanıyor…">
              Görevi tamamla
            </SubmitButton>
          </div>
        </form>
      </div>
    </details>
  );
}

function TaskCard({
  task,
  canManage,
  defaultActionAt,
  overdue,
}: {
  task: TaskQueueItem;
  canManage: boolean;
  defaultActionAt: string;
  overdue: boolean;
}) {
  const location =
    [task.property.neighborhood, task.property.district, task.property.city]
      .filter(Boolean)
      .join(" · ") || "Konum bilgisi girilmemiş";

  return (
    <article className="rounded-3xl border border-[var(--line)] bg-white p-4 text-[var(--ink)] shadow-[0_10px_30px_rgba(18,37,29,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand)]">
            {task.typeLabel}
          </p>
          <h4 className="mt-1 text-lg font-black">{location}</h4>
        </div>
        {overdue ? (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-extrabold text-red-800">
            Gecikmiş
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <dt className="text-xs font-bold text-[var(--muted)]">Tarih</dt>
          <dd className="mt-1 font-extrabold">
            {dateFormatter.format(new Date(task.dueAt))}
          </dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <dt className="text-xs font-bold text-[var(--muted)]">Durum</dt>
          <dd className="mt-1 font-extrabold">{task.stageLabel}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm text-[var(--muted)]">
        {task.property.typeLabel}
      </p>

      <Link
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-[var(--line)] px-4 text-sm font-extrabold text-[var(--brand)]"
        href={`/workspace/radar/${task.opportunityId}`}
      >
        Fırsatı aç
      </Link>

      {canManage ? (
        <TaskActions task={task} defaultActionAt={defaultActionAt} />
      ) : (
        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          Görevi sahip veya danışman rolü yönetebilir.
        </p>
      )}
    </article>
  );
}

function TaskSection({
  title,
  description,
  tasks,
  canManage,
  defaultActionAt,
  overdue = false,
}: {
  title: string;
  description: string;
  tasks: TaskQueueItem[];
  canManage: boolean;
  defaultActionAt: string;
  overdue?: boolean;
}) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="mt-5" aria-labelledby={`task-section-${title}`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3
            className="text-lg font-black"
            id={`task-section-${title}`}
          >
            {title}
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
        <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-extrabold text-[var(--brand)]">
          {tasks.length}
        </span>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {tasks.map((task) => (
          <TaskCard
            canManage={canManage}
            defaultActionAt={defaultActionAt}
            key={task.id}
            overdue={overdue}
            task={task}
          />
        ))}
      </div>
    </section>
  );
}

export function TaskQueuePanel({
  result,
  canManage,
  defaultActionAt,
}: {
  result: TaskQueueResult;
  canManage: boolean;
  defaultActionAt: string;
}) {
  return (
    <section className="mt-8 rounded-3xl bg-white p-5 text-[var(--ink)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand)]">
        Günlük çalışma
      </p>
      <h2 className="mt-2 text-xl font-black">Görevler ve gecikmiş takipler</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Açık ve iletişime uygun görüşme takipleri Türkiye saatine göre sıralanır.
      </p>

      {!result.ok ? (
        <div
          className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-extrabold">Görevler yüklenemedi</p>
          <p className="mt-1 leading-6">{result.error.message}</p>
        </div>
      ) : null}

      {result.ok ? (
        <>
          <dl className="mt-5 grid grid-cols-3 gap-2">
            {[
              ["Gecikmiş", result.data.overdue.length],
              ["Bugün", result.data.today.length],
              ["Yaklaşan", result.data.upcoming.length],
            ].map(([label, count]) => (
              <div
                className="rounded-2xl bg-slate-50 px-3 py-3 text-center"
                key={label}
              >
                <dt className="text-xs font-bold text-[var(--muted)]">
                  {label}
                </dt>
                <dd className="mt-1 text-2xl font-black tabular-nums">
                  {count}
                </dd>
              </div>
            ))}
          </dl>

          {result.data.total === 0 ? (
            <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-[var(--muted)]">
              Açık takip görevi yok. Takip gerektiren bir görüşme
              kaydedildiğinde görev burada görünür.
            </p>
          ) : (
            <>
              <TaskSection
                canManage={canManage}
                defaultActionAt={defaultActionAt}
                description="Planlanan zamanı geçmiş açık takipler."
                overdue
                tasks={result.data.overdue}
                title="Gecikmiş"
              />
              <TaskSection
                canManage={canManage}
                defaultActionAt={defaultActionAt}
                description="Bugün tamamlanması planlanan takipler."
                tasks={result.data.today}
                title="Bugün"
              />
              <TaskSection
                canManage={canManage}
                defaultActionAt={defaultActionAt}
                description="Bugünden sonraki planlı takipler."
                tasks={result.data.upcoming}
                title="Yaklaşan"
              />
            </>
          )}

          {result.data.truncated ? (
            <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              İlk 50 görev gösteriliyor. Daha sonraki görevler için tarihleri
              tamamlayarak veya erteleyerek kuyruğu daraltın.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
