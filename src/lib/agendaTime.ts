export function humanizeMinutes(totalMinutes: number): string {
  const numeric = Number(totalMinutes);

  if (!Number.isFinite(numeric)) {
    return "tiempo configurado";
  }

  const minutes = Math.max(0, Math.round(numeric));

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
  const numeric = Number(totalHours);

  if (!Number.isFinite(numeric)) {
    return "tiempo configurado";
  }

  const hours = Math.max(0, Math.round(numeric));

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
  const numeric = Number(totalDays);

  if (!Number.isFinite(numeric)) {
    return "periodo configurado";
  }

  const days = Math.max(0, Math.round(numeric));
  return `${days} ${days === 1 ? "día" : "días"}`;
}

export function addDaysToDateInput(
  dateInput: string,
  days: number,
): string {
  if (
    typeof dateInput !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateInput)
  ) {
    return "";
  }

  const numericDays = Number(days);

  // Evita Runtime RangeError si el backend todavía no devuelve
  // maximum_booking_days o devuelve un valor inválido.
  if (!Number.isFinite(numericDays)) {
    return "";
  }

  const [year, month, day] = dateInput
    .split("-")
    .map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return "";
  }

  const date = new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
    0,
  );

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(
    date.getDate() + Math.max(0, Math.round(numericDays)),
  );

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  );

  if (Number.isNaN(local.getTime())) {
    return "";
  }

  return local.toISOString().slice(0, 10);
}

export function dateInputInTimeZone(
  value: string | Date,
  timeZone: string,
): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime()) || !timeZone) {
    return "";
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );

    if (!values.year || !values.month || !values.day) {
      return "";
    }

    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return "";
  }
}

export function cancellationDeadline(
  startAt: string,
  cancellationNoticeHours: number,
): Date {
  const start = new Date(startAt);
  const hours = Number(cancellationNoticeHours);

  if (
    Number.isNaN(start.getTime()) ||
    !Number.isFinite(hours)
  ) {
    return new Date(Number.NaN);
  }

  return new Date(
    start.getTime() -
      hours * 60 * 60 * 1000,
  );
}

export function canStillCancel(
  startAt: string,
  cancellationNoticeHours: number,
  now = new Date(),
): boolean {
  const deadline = cancellationDeadline(
    startAt,
    cancellationNoticeHours,
  );

  if (
    Number.isNaN(deadline.getTime()) ||
    Number.isNaN(now.getTime())
  ) {
    return false;
  }

  return now.getTime() <= deadline.getTime();
}

function joinHumanParts(parts: string[]): string {
  if (parts.length === 0) return "0 minutos";
  if (parts.length === 1) return parts[0];

  return `${parts
    .slice(0, -1)
    .join(", ")} y ${parts[parts.length - 1]}`;
}
