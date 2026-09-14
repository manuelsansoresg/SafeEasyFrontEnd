export function humanizeMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));

  if (minutes === 0) return "sin anticipación mínima";

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} ${days === 1 ? "día" : "días"}`);
  }

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
  }

  if (remainingMinutes > 0) {
    parts.push(
      `${remainingMinutes} ${
        remainingMinutes === 1 ? "minuto" : "minutos"
      }`,
    );
  }

  return joinHumanParts(parts);
}

export function humanizeHours(totalHours: number): string {
  const hours = Math.max(0, Math.round(totalHours));

  if (hours === 0) return "sin anticipación mínima";

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} ${days === 1 ? "día" : "días"}`);
  }

  if (remainingHours > 0) {
    parts.push(
      `${remainingHours} ${
        remainingHours === 1 ? "hora" : "horas"
      }`,
    );
  }

  return joinHumanParts(parts);
}

export function humanizeDays(totalDays: number): string {
  const days = Math.max(0, Math.round(totalDays));
  return `${days} ${days === 1 ? "día" : "días"}`;
}

export function addDaysToDateInput(
  dateInput: string,
  days: number,
): string {
  const [year, month, day] = dateInput
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    Math.max(0, month - 1),
    day,
    12,
    0,
    0,
    0,
  );

  date.setDate(date.getDate() + days);

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  );

  return local.toISOString().slice(0, 10);
}

export function cancellationDeadline(
  startAt: string,
  cancellationNoticeHours: number,
): Date {
  return new Date(
    new Date(startAt).getTime() -
      cancellationNoticeHours * 60 * 60 * 1000,
  );
}

export function canStillCancel(
  startAt: string,
  cancellationNoticeHours: number,
  now = new Date(),
): boolean {
  return (
    now.getTime() <=
    cancellationDeadline(
      startAt,
      cancellationNoticeHours,
    ).getTime()
  );
}

function joinHumanParts(parts: string[]): string {
  if (parts.length === 0) return "0 minutos";
  if (parts.length === 1) return parts[0];

  return `${parts
    .slice(0, -1)
    .join(", ")} y ${parts[parts.length - 1]}`;
}
