const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' });
export function publicationDate(value: string | null) {
  return value && Number.isFinite(Date.parse(value))
    ? { label: dateFormat.format(new Date(value)), dateTime: value }
    : { label: 'Publication date unavailable', dateTime: undefined };
}
